# =====================================================================
#  Статистика сайту кафедри з Google Analytics 4 (GA4) → графіки ggplot2
#  Тег на сайті: G-JWWGPMG71W (Measurement ID — ідентифікатор потоку даних)
# =====================================================================

# --- 0. Пакети ---------------------------------------------------------
pkgs <- c("googleAnalyticsR", "dplyr", "tidyr", "ggplot2", "scales",
          "forcats", "stringr", "patchwork")
new  <- setdiff(pkgs, rownames(installed.packages()))
if (length(new)) install.packages(new)
invisible(lapply(pkgs, library, character.only = TRUE))

# --- 1. Авторизація і propertyId -------------------------------------
# ЗАПУСКАЙТЕ ВЕСЬ ФАЙЛ кнопкою «Source» (Ctrl+Shift+S), а не «Run».
# Якщо виділити все і натиснути «Run», R читає наступні рядки скрипту
# як відповіді на меню «Enter a number between 1 and 2» → нічого не будується.
#
# email = TRUE — взяти вже збережений вхід Google без меню вибору акаунта
# (перший раз відкриється браузер для входу).
ga_auth(email = TRUE)

# propertyId — це ЧИСЛО (напр. 412345678), а не "G-JWWGPMG71W".
# Знайти: таблиця нижче (стовпчик propertyId) або
# GA → Адміністратор → Відомості про ресурс → «Ідентифікатор ресурсу».
props <- ga_account_list("ga4")
print(props)

prop  <- NA                             # <-- впишіть propertyId, напр. 412345678
if (is.na(prop)) {
  if (nrow(props) == 1) {
    prop <- props$propertyId[1]         # ресурс один — беремо його
    message("Використовую propertyId = ", prop)
  } else {
    stop("Впишіть propertyId у рядок `prop <- ...` (див. таблицю вище).")
  }
}
start <- "2026-10-01"
end   <- "2026-11-14"

out_dir <- "ga4_plots"
dir.create(out_dir, showWarnings = FALSE)

# --- 2. Допоміжна функція запиту -------------------------------------
# Кожен розріз — окремим запитом: activeUsers НЕ можна підсумовувати
# по сторінках/країнах (одна людина рахується в кожному рядку → завищення).
get_ga <- function(dims, mets, ...) {
  ga_data(prop,
          date_range = c(start, end),
          dimensions = dims,
          metrics    = mets,
          limit      = -1, ...)
}

# Розділи сайту за першою частиною адреси (працює і з префіксом /kafedra/)
section_of <- function(path) {
  seg <- str_match(path, "/(konspekt|lab|microscope|modeling|about|qr)(/|$)")[, 2]
  dplyr::case_when(
    seg == "konspekt"                     ~ "Конспект",
    seg == "lab"                          ~ "Онлайн лабораторія",
    seg == "about"                        ~ "Про кафедру",
    seg == "qr"                           ~ "Перехід за QR-кодом",
    seg %in% c("microscope", "modeling")  ~ "Старі адреси (переадресація)",
    TRUE                                  ~ "Головна та інше"
  )
}

# --- 3. Дані ----------------------------------------------------------
kpi <- get_ga(NULL, c("activeUsers", "newUsers", "sessions",
                      "screenPageViews", "engagementRate",
                      "userEngagementDuration"))

daily <- get_ga("date", c("activeUsers", "screenPageViews"))

pages <- get_ga(c("pagePath", "pageTitle"),
                c("screenPageViews", "activeUsers", "userEngagementDuration"))

country  <- get_ga("country", "activeUsers")
device   <- get_ga("deviceCategory", "activeUsers")
channel  <- get_ga("sessionDefaultChannelGroup", "sessions")
weekhour <- get_ga(c("dayOfWeek", "hour"), "screenPageViews")

# --- 4. Підсумок у консоль -------------------------------------------
with(kpi, cat(sprintf(
  "\nПеріод %s — %s\nКористувачі: %s (нові: %s)\nСеанси: %s\nПерегляди сторінок: %s\nЧастка залучених сеансів: %.0f%%\nСередній час на користувача: %.1f хв\n\n",
  start, end,
  comma(activeUsers), comma(newUsers), comma(sessions), comma(screenPageViews),
  100 * engagementRate, userEngagementDuration / activeUsers / 60)))

# --- 5. Оформлення ----------------------------------------------------
col_main <- "#2a78d6"                   # один ряд даних — один колір
theme_kaf <- theme_minimal(base_size = 12) +
  theme(panel.grid.minor   = element_blank(),
        panel.grid.major.y = element_line(colour = "grey92"),
        panel.grid.major.x = element_blank(),
        plot.title         = element_text(face = "bold"),
        plot.title.position = "plot",
        axis.title         = element_text(colour = "grey35"))
theme_hbar <- theme_kaf +              # для горизонтальних стовпчиків
  theme(panel.grid.major.y = element_blank(),
        panel.grid.major.x = element_line(colour = "grey92"))

hbar <- function(df, x, y, title, xlab, n = 10) {
  df |>
    slice_max({{ x }}, n = n, with_ties = FALSE) |>
    mutate(lbl = fct_reorder(str_trunc({{ y }}, 50), {{ x }})) |>
    ggplot(aes({{ x }}, lbl)) +
    geom_col(fill = col_main, width = 0.7) +
    geom_text(aes(label = comma({{ x }})), hjust = -0.15, size = 3.4,
              colour = "grey20") +
    scale_x_continuous(expand = expansion(mult = c(0, 0.12)),
                       labels = comma) +
    labs(title = title, x = xlab, y = NULL) +
    theme_hbar
}

# --- 6. Графіки -------------------------------------------------------
# 6.1 Щоденні відвідувачі + ковзне середнє за 7 днів
p_daily <- daily |>
  arrange(date) |>
  mutate(date = if (is.character(date)) as.Date(date, "%Y%m%d") else date,
         ma7  = as.numeric(stats::filter(activeUsers, rep(1 / 7, 7), sides = 1))) |>
  ggplot(aes(date)) +
  geom_col(aes(y = activeUsers), fill = col_main, alpha = 0.35, width = 0.8) +
  geom_line(aes(y = ma7), colour = col_main, linewidth = 1, na.rm = TRUE) +
  scale_x_date(date_labels = "%d.%m", date_breaks = "1 week") +
  labs(title = "Відвідувачі за днями",
       subtitle = "Стовпчики — за день; лінія — ковзне середнє за 7 днів",
       x = NULL, y = "Активні користувачі") +
  theme_kaf

# 6.2 Розділи сайту
sections <- pages |>
  mutate(section = section_of(pagePath)) |>
  group_by(section) |>
  summarise(views = sum(screenPageViews),
            eng_min = sum(userEngagementDuration) / 60, .groups = "drop")

p_sections <- hbar(sections, views, section,
                   "Перегляди за розділами сайту", "Перегляди сторінок")

# 6.3 Топ-15 сторінок (назва з <title> без хвоста «— Кафедра…»)
top_pages <- pages |>
  mutate(title = str_remove(pageTitle, "\\s+—\\s+Кафедра.*$")) |>
  group_by(title) |>
  summarise(views = sum(screenPageViews), .groups = "drop")

p_pages <- hbar(top_pages, views, title,
                "Найпопулярніші сторінки", "Перегляди сторінок", n = 15)

# 6.4 Країни, пристрої, джерела трафіку
p_country <- hbar(country, activeUsers, country,
                  "Країни відвідувачів", "Активні користувачі")

p_device <- device |>
  mutate(deviceCategory = recode(deviceCategory,
                                 desktop = "Комп'ютер", mobile = "Смартфон",
                                 tablet = "Планшет")) |>
  hbar(activeUsers, deviceCategory, "Пристрої", "Активні користувачі")

# Канали трафіку: Direct — пряме введення адреси / QR, Organic Search —
# пошук Google, Referral — перехід з іншого сайту, Organic Social — соцмережі
p_channel <- hbar(channel, sessions, sessionDefaultChannelGroup,
                  "Джерела трафіку", "Сеанси")

# 6.5 Теплова карта: день тижня × година (коли студенти заходять)
dow <- c("Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб")
p_heat <- weekhour |>
  mutate(day  = factor(dow[as.integer(dayOfWeek) + 1],
                       levels = rev(c(dow[-1], dow[1]))),
         hour = as.integer(hour)) |>
  complete(day, hour = 0:23, fill = list(screenPageViews = 0)) |>
  ggplot(aes(hour, day, fill = screenPageViews)) +
  geom_tile(colour = "white", linewidth = 0.6) +
  scale_fill_gradient(low = "#eef4fc", high = "#0b3d7a",
                      name = "Перегляди", labels = comma) +
  scale_x_continuous(breaks = seq(0, 23, 3), expand = c(0, 0)) +
  labs(title = "Коли відвідують сайт",
       subtitle = "Час — у часовому поясі ресурсу GA",
       x = "Година", y = NULL) +
  theme_kaf + theme(panel.grid = element_blank())

# --- 7. Показати і зберегти -----------------------------------------
plots <- list(daily = p_daily, sections = p_sections, pages = p_pages,
              country = p_country, device = p_device, channel = p_channel,
              heatmap = p_heat)

for (nm in names(plots)) {
  print(plots[[nm]])
  ggsave(file.path(out_dir, paste0(nm, ".png")), plots[[nm]],
         width = 8, height = 5, dpi = 200, bg = "white")
}

dashboard <- (p_daily | p_sections) / (p_pages | p_heat) /
             (p_country | p_device | p_channel) +
  plot_annotation(
    title    = "Сайт кафедри фізіології, біохімії рослин та біоенергетики",
    subtitle = sprintf("Google Analytics 4, %s — %s", start, end),
    theme    = theme(plot.title = element_text(face = "bold", size = 16)))

ggsave(file.path(out_dir, "dashboard.png"), dashboard,
       width = 18, height = 16, dpi = 150, bg = "white")

# Таблиці — для звіту/Excel
write.csv(arrange(top_pages, desc(views)), file.path(out_dir, "pages.csv"),
          row.names = FALSE, fileEncoding = "UTF-8")
write.csv(arrange(sections, desc(views)), file.path(out_dir, "sections.csv"),
          row.names = FALSE, fileEncoding = "UTF-8")

message("Готово: ", normalizePath(out_dir))
