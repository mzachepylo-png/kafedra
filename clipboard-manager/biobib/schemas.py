"""Pydantic-схеми запитів і відповідей API."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class AuthorIn(BaseModel):
    role: str = "author"
    family: str = Field(..., min_length=1)
    given_initials: str = ""
    orcid: str = ""
    position: int = 0


class AuthorOut(AuthorIn):
    id: int


class FileOut(BaseModel):
    id: int
    source_id: int
    path: str
    original_name: str
    label: str
    mime: str
    size: int
    has_text: bool = False
    created_at: str


class NoteIn(BaseModel):
    kind: str = "description"  # description | quote | note
    text: str = ""
    page: str = ""
    comment: str = ""


class NoteOut(NoteIn):
    id: int
    source_id: int
    created_at: str
    updated_at: str


class SourceCreate(BaseModel):
    type: str = "article"
    title: str = Field(..., min_length=1)
    subtitle: str = ""
    container_title: str = ""
    publisher: str = ""
    place: str = ""
    year: Optional[int] = None
    volume: str = ""
    issue: str = ""
    pages: str = ""
    page_count: Optional[int] = None
    doi: str = ""
    pmid: str = ""
    isbn: str = ""
    issn: str = ""
    url: str = ""
    accessed_date: str = ""
    language: str = "uk"
    keywords: str = ""
    status: str = "unread"
    rating: int = Field(default=0, ge=0, le=5)
    study_object: str = ""
    methods: str = ""
    main_results: str = ""
    for_dissertation: str = ""
    authors: List[AuthorIn] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    section_ids: Optional[List[int]] = None      # розділи «Посилання» (папки/підпапки); None — не змінювати


class SourceUpdate(SourceCreate):
    pass


class SourceSummary(BaseModel):
    id: int
    type: str
    title: str
    subtitle: str
    container_title: str
    year: Optional[int]
    language: str
    status: str
    rating: int
    doi: str
    authors: List[AuthorOut]
    tags: List[str]
    file_count: int
    note_count: int
    citation_dstu: str
    in_text_citation: str
    created_at: str
    updated_at: str
    match_snippet: Optional[str] = None
    match_field: Optional[str] = None


class SourceDetail(SourceSummary):
    publisher: str
    place: str
    volume: str
    issue: str
    pages: str
    page_count: Optional[int]
    pmid: str
    isbn: str
    issn: str
    url: str
    accessed_date: str
    keywords: str
    study_object: str
    methods: str
    main_results: str
    for_dissertation: str
    files: List[FileOut]
    notes: List[NoteOut]


class SectionIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=80)
    parent_id: Optional[int] = None


class SettingsUpdate(BaseModel):
    dstu_four_plus_authors: Optional[str] = None
    citation_style: Optional[str] = None
    numbering_mode: Optional[str] = None
