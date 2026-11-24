"""Головний модуль FastAPI застосунку BioBib (Етап 1 — MVP)."""

from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Iterator

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import config, crud, library, sections
from .database import get_connection, init_db
from .schemas import NoteIn, SectionIn, SettingsUpdate, SourceCreate, SourceUpdate


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="BioBib — менеджер бібліографії для дисертації",
    version="0.1.0",
    lifespan=lifespan,
)


def get_db() -> Iterator:
    conn = get_connection(config.DB_PATH)
    try:
        yield conn
    finally:
        conn.close()


if config.STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(config.STATIC_DIR)), name="static")


@app.get("/", response_class=HTMLResponse)
def index_page() -> FileResponse:
    index_file = config.STATIC_DIR / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Файл інтерфейсу не знайдено")
    return FileResponse(str(index_file))


@app.get("/reader/{source_id}", response_class=HTMLResponse)
def reader_page(source_id: int) -> FileResponse:
    """Читалка повного тексту дослідження (дані — з /api/read/{source_id})."""
    page = config.STATIC_DIR / "reader.html"
    if not page.exists():
        raise HTTPException(status_code=404, detail="Файл читалки не знайдено")
    return FileResponse(str(page))


@app.get("/api/read/{source_id}")
def api_read(source_id: int, file: int | None = Query(default=None), conn=Depends(get_db)) -> dict:
    data = library.reader_data(conn, source_id, file, storage_dir=config.STORAGE_DIR)
    if data is None:
        raise HTTPException(status_code=404, detail="Джерело не знайдено")
    return data


@app.post("/api/files/{file_id}/open")
def api_open_file(file_id: int, reveal: bool = Query(default=False),
                  x_biobib: str | None = Header(default=None), conn=Depends(get_db)) -> dict[str, bool]:
    """Відкриває прикріплений файл на цьому комп'ютері (або показує його в Провіднику). Лише із заголовком
    X-BioBib: інші сайти в браузері не можуть надіслати такий запит на 127.0.0.1 без дозволу CORS."""
    if x_biobib != "1":
        raise HTTPException(status_code=403, detail="Потрібен заголовок X-BioBib")
    path = library.file_path(conn, file_id, storage_dir=config.STORAGE_DIR)
    if path is None or not path.exists():
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    if not library.open_on_disk(path, reveal=reveal):
        raise HTTPException(status_code=500, detail="Не вдалося відкрити файл")
    return {"opened": True}


@app.get("/api/health")
def health() -> dict[str, str]:
    """Для другої копії BioBib.exe: та сама програма й тека даних — тоді лише відкрити бібліотеку."""
    from . import __version__
    return {"status": "ok", "app": "biobib", "version": __version__,
            "data_dir": str(Path(config.DATA_DIR).resolve())}


@app.get("/api/settings")
def api_get_settings(conn=Depends(get_db)) -> dict:
    return crud.get_settings(conn)


@app.patch("/api/settings")
def api_update_settings(payload: SettingsUpdate, conn=Depends(get_db)) -> dict:
    return crud.update_settings(conn, payload.model_dump(exclude_none=True))


@app.get("/api/tags")
def api_list_tags(conn=Depends(get_db)) -> list[dict]:
    return crud.list_all_tags(conn)


@app.get("/api/sources")
def api_list_sources(
    q: str = Query(default="", description="Пошуковий запит"),
    sort: str = Query(default="updated_desc", description="Сортування"),
    section: int | None = Query(default=None, description="Лише джерела розділу (папки/підпапки)"),
    conn=Depends(get_db),
) -> list[dict]:
    return crud.list_sources(conn, q=q, sort=sort, section_id=section)


# -- розділи «Посилання»: папки → підпапки ------------------------------------------------------------------
@app.get("/api/sections")
def api_list_sections(conn=Depends(get_db)) -> list[dict]:
    return sections.list_sections(conn, all_levels=True)


@app.post("/api/sections", status_code=201)
def api_create_section(payload: SectionIn, conn=Depends(get_db)) -> dict:
    item = sections.create_section(conn, payload.title, payload.parent_id)
    if not item:
        raise HTTPException(status_code=400, detail="Підпапку можна створити лише в папці верхнього рівня")
    return item


@app.patch("/api/sections/{section_id}")
def api_rename_section(section_id: int, payload: SectionIn, conn=Depends(get_db)) -> dict:
    if not sections.rename_section(conn, section_id, payload.title):
        raise HTTPException(status_code=404, detail="Розділ не знайдено")
    return sections.get_section(conn, section_id)


@app.delete("/api/sections/{section_id}")
def api_delete_section(section_id: int, conn=Depends(get_db)) -> dict[str, bool]:
    if not sections.delete_section(conn, section_id):
        raise HTTPException(status_code=404, detail="Розділ не знайдено")
    return {"deleted": True}


@app.post("/api/sections/{section_id}/move")
def api_move_section(section_id: int, delta: int = Query(...), conn=Depends(get_db)) -> dict[str, bool]:
    return {"moved": sections.move_section(conn, section_id, delta)}


@app.post("/api/attach-pdfs")
async def api_attach_pdfs(files: list[UploadFile] = File(...), source_id: int | None = Form(default=None),
                          conn=Depends(get_db)) -> dict:
    """«Прикріпити PDF…»: кілька PDF або ZIP — кожен файл сам знаходить своє джерело (вміст, DOI, назва)."""
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        paths = []
        for n, f in enumerate(files):
            name = Path(f.filename or f"file{n}.pdf").name or f"file{n}.pdf"
            sub = Path(tmp) / str(n)
            sub.mkdir()
            (sub / name).write_bytes(await f.read())
            paths.append(str(sub / name))
        rep = library.attach_pdfs(conn, paths, storage_dir=config.STORAGE_DIR, source_id=source_id)
    return {"attached": [{"file": n, "source_id": sid, "title": t, "how": how} for n, sid, t, how in rep["attached"]],
            "duplicate": [{"file": n, "reason": why} for n, why in rep["duplicate"]],
            "not_pdf": rep["not_pdf"], "unmatched": rep["unmatched"]}


@app.post("/api/dedupe")
def api_dedupe(conn=Depends(get_db)) -> dict:
    merged = library.dedupe_sources(conn, storage_dir=config.STORAGE_DIR)
    return {"sources_removed": sum(len(m["removed"]) for m in merged),
            "files_removed": sum(1 for m in merged if m.get("file_removed")), "merged": merged}


@app.post("/api/sections/{section_id}/sources/{source_id}")
def api_attach_source(section_id: int, source_id: int, conn=Depends(get_db)) -> dict[str, bool]:
    return {"attached": sections.attach(conn, source_id, section_id)}


@app.delete("/api/sections/{section_id}/sources/{source_id}")
def api_detach_source(section_id: int, source_id: int, conn=Depends(get_db)) -> dict[str, bool]:
    return {"detached": sections.detach(conn, source_id, section_id)}


@app.get("/api/sections/{section_id}/bibliography")
def api_bibliography(section_id: int, conn=Depends(get_db)) -> dict[str, str]:
    return {"text": sections.bibliography(conn, section_id)}


@app.post("/api/sources", status_code=201)
def api_create_source(payload: SourceCreate, conn=Depends(get_db)) -> dict:
    return crud.create_source(conn, payload)


@app.get("/api/sources/{source_id}")
def api_get_source(source_id: int, conn=Depends(get_db)) -> dict:
    item = crud.get_source(conn, source_id)
    if not item:
        raise HTTPException(status_code=404, detail="Джерело не знайдено")
    return item


@app.put("/api/sources/{source_id}")
def api_update_source(source_id: int, payload: SourceUpdate, conn=Depends(get_db)) -> dict:
    item = crud.update_source(conn, source_id, payload)
    if not item:
        raise HTTPException(status_code=404, detail="Джерело не знайдено")
    return item


@app.delete("/api/sources/{source_id}")
def api_delete_source(
    source_id: int,
    delete_files: bool = Query(default=False),
    conn=Depends(get_db),
) -> dict[str, bool]:
    deleted = crud.delete_source(
        conn, source_id, delete_files=delete_files, storage_dir=config.STORAGE_DIR
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Джерело не знайдено")
    return {"deleted": True}


@app.post("/api/sources/{source_id}/files", status_code=201)
async def api_upload_file(
    source_id: int,
    file: UploadFile = File(...),
    label: str = Form(default=""),
    conn=Depends(get_db),
) -> dict:
    content = await file.read()
    record = crud.attach_file(
        conn=conn,
        source_id=source_id,
        original_name=file.filename or "file",
        content=content,
        label=label,
        content_type=file.content_type,
        storage_dir=config.STORAGE_DIR,
    )
    if not record:
        raise HTTPException(status_code=404, detail="Джерело не знайдено")
    return record


@app.get("/api/files/{file_id}")
def api_serve_file(
    file_id: int,
    download: bool = Query(default=False),
    conn=Depends(get_db),
) -> FileResponse:
    record = crud.get_file_record(conn, file_id)
    if not record:
        raise HTTPException(status_code=404, detail="Файл не знайдено")

    file_path = Path(config.STORAGE_DIR) / record["path"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл відсутній на диску")

    mime = record["mime"] or "application/octet-stream"
    is_inline = (mime == "application/pdf" or mime.startswith("image/")) and not download

    if is_inline:
        return FileResponse(
            path=str(file_path),
            media_type=mime,
            headers={"Content-Disposition": f'inline; filename="{record["original_name"]}"'},
        )
    return FileResponse(
        path=str(file_path),
        media_type=mime,
        filename=record["original_name"],
    )


@app.delete("/api/files/{file_id}")
def api_delete_file(file_id: int, conn=Depends(get_db)) -> dict[str, bool]:
    deleted = crud.delete_file_record(conn, file_id, storage_dir=config.STORAGE_DIR)
    if not deleted:
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    return {"deleted": True}


@app.post("/api/sources/{source_id}/notes", status_code=201)
def api_add_note(source_id: int, payload: NoteIn, conn=Depends(get_db)) -> dict:
    note = crud.add_note(conn, source_id, payload)
    if not note:
        raise HTTPException(status_code=404, detail="Джерело не знайдено")
    return note


@app.put("/api/notes/{note_id}")
def api_update_note(note_id: int, payload: NoteIn, conn=Depends(get_db)) -> dict:
    note = crud.update_note(conn, note_id, payload)
    if not note:
        raise HTTPException(status_code=404, detail="Нотатку не знайдено")
    return note


@app.delete("/api/notes/{note_id}")
def api_delete_note(note_id: int, conn=Depends(get_db)) -> dict[str, bool]:
    deleted = crud.delete_note(conn, note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Нотатку не знайдено")
    return {"deleted": True}
