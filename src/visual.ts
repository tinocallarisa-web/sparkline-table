/*
 * Sparkline Table by TCViz — bloque 1 (todo lo gratis).
 *
 * Tabla con jerarquía de filas (hasta 3 niveles, expandir/contraer del host, subtotales del motor) y, por fila: nombre,
 * valor (último periodo o total del rango), Δ y Δ% con signo, hasta dos medidas más y un minigráfico (línea, área,
 * columnas, win/loss o bullet) con marcadores, objetivo y el último valor. Rejilla virtualizada, ordenar por la cifra
 * que se ve, teclado, tooltip, selección (también de subtotales), highlight, alto contraste, Report theme + Classic,
 * 12 idiomas, pantalla de inicio con asistente y formato desde el lienzo.
 *
 * Reglas de la cartera que se cumplen aquí:
 *  - renderingStarted / Finished|Failed 1:1 por update(); fetchMoreData genera updates nuevos y cada uno lleva su par.
 *    Scroll, hover, selección, teclado, orden local y licencia repintan con render()/drawRows(), sin eventos.
 *  - Subtotales SIEMPRE del motor (model.ts). Δ% con base 0 o negativa → vacío.
 *  - Identidad de fila con la ruta completa; clic en un subtotal = las identidades de todas sus hojas cargadas.
 *  - Expandir/contraer lo guarda el host (toggleExpandCollapse): nunca persistProperties al expandir ni en
 *    registerOnSelectCallback. persistProperties solo desde un clic explícito (asistente y orden por cabecera).
 *  - allowInteractions desde host.hostCapabilities. Sin innerHTML, sin red.
 *  - Formato de números del modelo (source.format, formato dinámico por punto y host.locale).
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { select, Selection } from "d3-selection";
import { line as d3line, area as d3area, curveLinear, curveMonotoneX, curveStep } from "d3-shape";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import {
    HtmlSubSelectableClass, HtmlSubSelectionHelper, SubSelectableDisplayNameAttribute,
    SubSelectableObjectNameAttribute, SubSelectableTypeAttribute,
} from "powerbi-visuals-utils-onobjectutils";
import "./../style/visual.less";

import { STRINGS } from "./strings";
import { OBJECTS, PANE, PropSpec } from "./formatSpec";
import { buildModel, flatten, selectionIdsOf, periodMonth, Model, Row, Num } from "./model";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

type Settings = Record<string, Record<string, any>>;

// build-test.js la rellena con "test AAAA-MM-DD HH:MM vX"; en producción va vacía y no se pinta.
const TEST_STAMP = ""; // TEST_STAMP_MARKER

/** Plan previsto en Partner Center (serie económica 0,99/9,99). El bloque 1 no tiene funciones Pro todavía. */
const PLAN_IDS = ["sparkline-table-pro"];
const STATE_ACTIVE = 1;
const STATE_WARNING = 2;
function matchesPlan(sp: unknown, planId: string): boolean {
    const s = String(sp ?? "");
    return s === planId || s.endsWith("." + planId);
}

// Enlaces de la pantalla de inicio: solo con un clic, por host.launchUrl.
const URL_GUIDE = "https://tinocallarisa-web.github.io/sparkline-table/support.html";
const URL_PRODUCT = "https://tcviz.com/product/sparkline-table/?ref=visual-sparkline-table";

const FONT = "'Segoe UI', wf_segoe-ui_normal, helvetica, arial, sans-serif";
const MARGIN_ROWS = 8;
const PAD = 6;
const MINUS = "−";

interface Look { bg: string; text: string; soft: string; rule: string; line: string; accent: string; up: string; down: string; target: string; sub: string; sel: string; hover: string; band: string; }

const CLASSIC: Look = {
    bg: "#FFFFFF", text: "#252423", soft: "#605E5C", rule: "#C8C6C4", line: "#8A8886", accent: "#118DFF", up: "#107C10",
    down: "#C4314B", target: "#252423", sub: "#F7F7F7", sel: "#DEECF9", hover: "#F3F2F1", band: "#EDEBE9",
};

type ColId = "name" | "val" | "delta" | "pct" | "pl" | "py" | "fc" | "vabs" | "vbar" | "vpct" | "stat" | "m2" | "m3" | "spark" | "spark2" | "spark3";
interface Col { id: ColId; w: number; sortKey: string | null; }
/** Orden de las columnas = orden de las celdas en el DOM (la rejilla las coloca por orden; las ocultas no ocupan). */
const COL_ORDER: ColId[] = ["name", "val", "delta", "pct", "pl", "py", "fc", "vabs", "vbar", "vpct", "stat", "m2", "m3", "spark", "spark2", "spark3"];
const OPTIONAL_COLS: ColId[] = COL_ORDER.filter(c => c !== "name" && c !== "spark");
/** Columnas de referencia: [Plan, Prior year, Forecast] en el mismo orden que Row.refs. */
const REF_COLS: ColId[] = ["pl", "py", "fc"];
/** Letras de escenario (notación habitual en las cuentas de gestión; no se rotula ningún estándar). */
const REF_CODES = ["PL", "PY", "FC"];

/** Funciones Pro (bloque 2), con su nombre para la marca de agua y el aviso de Power BI. */
type ProFeature = "variance" | "status" | "sparklines" | "styles" | "fx" | "images" | "horizon";

interface Geo {
    gen: number; line: string; area: string; pos: string; neg: string; tgt: string; band: string;
    b1: string; b2: string; b3: string; bandName: string; color: string;
    mkFirst: string; mkMax: string; mkMin: string; mkNeg: string; mkLast: string;
    lastX: number; lastY: number; lastText: string;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selMgr: ISelectionManager;
    private loc: ILocalizationManager;
    private element: HTMLElement;
    private root: HTMLDivElement;
    private header: HTMLDivElement;
    private notice: HTMLDivElement;
    private scroller: HTMLDivElement;
    private spacer: HTMLDivElement;
    private layerEl: HTMLDivElement;
    private layer: Selection<HTMLDivElement, unknown, null, undefined>;
    private totalEl: HTMLDivElement;
    private live: HTMLDivElement;
    private stamp: HTMLDivElement;
    private guideEl: HTMLDivElement | null = null;
    private subSelectionHelper: HtmlSubSelectionHelper;
    public visualOnObjectFormatting: powerbi.extensibility.visual.VisualOnObjectFormatting;

    private isPro = false; // ISPRO_MARKER
    private licenseRequested = false;

    private lastOptions: VisualUpdateOptions | null = null;
    private dataView: DataView | null = null;
    private model: Model | null = null;
    private rows: Row[] = [];
    private settings: Settings = {};
    private look: Look = CLASSIC;
    private editing = false;
    private formatMode = false;
    private guideStep = 1;
    private W = 0;
    private H = 0;
    private rowH = 24;
    private cols: Col[] = [];
    private sparkW = 120;
    private labelW = 0;
    private gen = 0;
    private periodLabels: string[] = [];
    private baseIdx = -1;
    private compareUsed: "previous" | "lastYear" = "previous";
    private valueModeUsed: "last" | "total" = "last";
    private ext = new Map<number, [number, number]>();
    private extBullet = new Map<number, [number, number]>();
    private fmtCache = new Map<string, valueFormatter.IValueFormatter>();
    private canvasCtx: CanvasRenderingContext2D | null = null;

    // fetchMoreData
    private loading = false;
    private ceiling = false;
    private modelMs = 0;
    private barExt = new Map<number, [number, number]>();
    private searchBar: HTMLDivElement;
    private searchInput: HTMLInputElement;
    private searchCount: HTMLDivElement;
    private query = "";
    private matchSet = new Set<Row>();
    /** Expandir todo: un paso por nivel, el siguiente tras el update del host (nunca dentro de update). */
    private expandChain: { steps: number } | null = null;
    // Gestos (ver constructor) y tooltips
    private rowsByKey = new Map<string, Row>();
    private downKey: string | null = null;
    private downZone = "row";
    private pointerBusy = false;
    private pendingToggle = new Map<string, number>();
    private tipTimer: number | null = null;
    /** Contadores de depuración (no se pintan; los lee el simulador). */
    public dbg = { toggles: 0, ignoredPending: 0, ignoredMismatch: 0, released: 0 };
    private imgUrlSeen = false;
    private tipShown = false;
    private imgLevels = new Set<number>();
    private watermarkEl: HTMLDivElement | null = null;
    private imagesDrawn = false;
    private licenseResolved = false;
    private licenseUnsupported = false;
    private proPreview = false;
    /** Funciones Pro que el informe PIDE ahora (se recalcula en cada render). */
    private proAsk: { labels: ProFeature[]; sig: string; set: Set<ProFeature> } = { labels: [], sig: "", set: new Set() };
    private lastBlockedNotice = "";
    private licenseIconTimer: number | null = null;
    private licenseIconShown = false;
    private watermarkTitle: HTMLDivElement | null = null;
    private watermarkWhy: HTMLDivElement | null = null;
    /** Varianza: |Δ| máximo por nivel (escala común de la barra). */
    private varExt = new Map<number, number>();
    private gap = 16;
    /** El alto pedido era menor que el texto y se ha subido (se avisa en el panel). */
    private rowHClamped = false;
    private levelStyles = new Map<number, { bg: string; color: string; fs: number; ff: string; bold: string; italic: boolean }>();
    /** El respaldo equals/includes solo para lo que devuelve un marcador (registerOnSelectCallback). */
    private restoreDeep = false;

    // Orden: el del panel, o el de un clic en la cabecera (local hasta que el panel lo recoge)
    private sortLocal: { by: string; dir: string } | null = null;
    private lastSettingsSort = "";

    // Selección propia: clave de la identidad (de nuestras filas) → identidad
    private sel = new Map<string, ISelectionId>();
    private selGen = 0;
    private selCache = new WeakMap<Row, { gen: number; v: boolean }>();
    private pendingRestore: ISelectionId[] | null = null;

    // Teclado y puntero
    private focusIdx = -1;
    private focusKey: string | null = null;
    private hasFocus = false;
    /** El anillo de foco solo con teclado (como :focus-visible): un clic de ratón no lo enciende. */
    private kbFocus = false;
    private scrollRaf = 0;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selMgr = options.host.createSelectionManager();
        this.loc = options.host.createLocalizationManager();
        this.element = options.element;

        this.root = this.div("st-root", options.element);
        this.root.tabIndex = 0;
        this.root.setAttribute("role", "treegrid");
        this.searchBar = this.div("st-search", this.root);
        this.searchInput = document.createElement("input");
        this.searchInput.type = "search";
        this.searchInput.className = "st-search-in";
        this.searchBar.appendChild(this.searchInput);
        this.searchCount = this.div("st-search-n", this.searchBar);
        this.searchInput.addEventListener("input", () => { this.query = this.searchInput.value; this.scroller.scrollTop = 0; this.repaint(); });
        this.searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
            e.stopPropagation();
            if (e.key === "Escape") { this.searchInput.value = ""; this.query = ""; this.repaint(); }
        });
        this.header = this.div("st-header", this.root);
        this.header.setAttribute("role", "row");
        this.notice = this.div("st-notice", this.root);
        this.scroller = this.div("st-scroller", this.root);
        this.spacer = this.div("st-spacer", this.scroller);
        this.layerEl = this.div("st-layer", this.scroller);
        this.layerEl.setAttribute("role", "rowgroup");
        this.layer = select(this.layerEl);
        this.totalEl = this.div("st-total", this.root);
        this.buildRowCells(select(this.totalEl));
        this.live = this.div("st-live", this.root);
        this.live.setAttribute("aria-live", "polite");
        this.stamp = this.div("st-stamp", this.root);
        this.stamp.textContent = TEST_STAMP;
        this.stamp.style.display = TEST_STAMP ? "block" : "none";
        this.stamp.setAttribute("aria-hidden", "true");

        this.subSelectionHelper = HtmlSubSelectionHelper.createHtmlSubselectionHelper({
            hostElement: options.element,
            subSelectionService: options.host.subSelectionService,
            selectionIdCallback: () => undefined,
        });
        this.visualOnObjectFormatting = {
            getSubSelectionStyles: (subs) => this.getSubSelectionStyles(subs),
            getSubSelectionShortcuts: (subs) => this.getSubSelectionShortcuts(subs),
            getSubSelectables: (filter) => this.subSelectionHelper.getAllSubSelectables(filter),
        };

        // Marcadores y selección desde fuera: solo derivar y repintar. Nunca persistProperties aquí.
        this.selMgr.registerOnSelectCallback((ids: ISelectionId[]) => {
            this.pendingRestore = ids || [];
            this.restoreDeep = true;
            this.applyRestore();
            this.drawRows();
        });

        this.scroller.addEventListener("scroll", () => {
            this.hideTip();
            if (this.scrollRaf) return;
            this.scrollRaf = requestAnimationFrame(() => { this.scrollRaf = 0; this.drawRows(); });
        });
        // Un solo gesto por clic, decidido en un único sitio (Tino, 12-11: "a veces expande y a veces no"):
        //  - pointerdown guarda la CLAVE de la fila y la zona; el clic solo cuenta si pointerup cae en la misma clave
        //    (si entre medias llegó un update y el nodo DOM se recicló con otra fila, se ignora);
        //  - zona nombre/triángulo de una fila expandible = expandir/contraer; resto de la fila = seleccionar;
        //  - mientras el host no ha contestado a un toggle, otro clic sobre esa fila se ignora (el triángulo ya
        //    enseña el estado pedido, atenuado); el update de datos lo libera.
        this.layerEl.addEventListener("pointerdown", (e: PointerEvent) => {
            if (e.button !== 0) return;
            this.hideTip();
            const rowEl = (e.target as HTMLElement).closest(".st-row") as HTMLElement | null;
            this.downKey = rowEl ? rowEl.getAttribute("data-key") : null;
            this.downZone = (e.target as HTMLElement).closest(".st-c-name") ? "name" : "row";
            this.pointerBusy = true;
        });
        this.layerEl.addEventListener("pointerup", () => { window.setTimeout(() => { this.pointerBusy = false; }, 0); });
        this.layerEl.addEventListener("click", (e: MouseEvent) => {
            const rowEl = (e.target as HTMLElement).closest(".st-row") as HTMLElement | null;
            const key = rowEl ? rowEl.getAttribute("data-key") : null;
            const zone = (e.target as HTMLElement).closest(".st-c-name") ? "name" : "row";
            const same = key !== null && key === this.downKey && zone === this.downZone;
            this.downKey = null;
            if (!same) { if (key !== null) this.dbg.ignoredMismatch++; return; }
            const r = this.rowsByKey.get(key as string);
            if (!r) return;
            e.stopPropagation();
            this.focusIdx = r.index;
            this.focusKey = r.key;
            if (!this.canInteract) return;
            if (zone === "name" && r.expandable) this.onToggle(r, e.altKey);
            else this.selectRow(r, e.ctrlKey || e.metaKey);
        });
        this.layerEl.addEventListener("mousemove", (e: MouseEvent) => {
            const rowEl = (e.target as HTMLElement).closest(".st-row") as HTMLElement | null;
            const r = rowEl ? this.rowsByKey.get(rowEl.getAttribute("data-key") || "") : undefined;
            if (r) this.onHover(e, r, rowEl as HTMLElement); else this.hideTip();
        });
        this.layerEl.addEventListener("mouseleave", () => this.hideTip());
        this.scroller.addEventListener("click", (e: MouseEvent) => {
            if (e.target === this.scroller || e.target === this.spacer || e.target === this.layerEl) this.clearSelection();
        });
        this.totalEl.addEventListener("click", () => this.clearSelection());
        this.totalEl.addEventListener("mousemove", (e: MouseEvent) => { if (this.model?.total) this.onHover(e, this.model.total, this.totalEl); });
        this.totalEl.addEventListener("mouseleave", () => this.hideTip());
        this.root.addEventListener("contextmenu", (e: MouseEvent) => {
            e.preventDefault();
            this.hideTip();
            if (!this.canInteract) return;
            const rowEl = (e.target as HTMLElement).closest(".st-row") as HTMLElement | null;
            const r = rowEl ? this.rowsByKey.get(rowEl.getAttribute("data-key") || "") : null;
            this.selMgr.showContextMenu(r && r.id ? r.id : ({} as ISelectionId), { x: e.clientX, y: e.clientY });
        });
        this.root.addEventListener("keydown", (e: KeyboardEvent) => { this.kbFocus = true; this.onKey(e); });
        this.root.addEventListener("mousedown", () => { this.kbFocus = false; });
        this.root.addEventListener("focus", () => { this.hasFocus = true; if (this.focusIdx < 0 && this.rows.length) this.focusIdx = 0; this.drawRows(); this.announce(); });
        this.root.addEventListener("blur", () => { this.hasFocus = false; this.drawRows(); });
    }

    // ── Textos y formato ─────────────────────────────────────────────────────

    /** Primero la tabla del bundle (Desktop solo traduce las claves de capabilities.json), luego el gestor, luego inglés. */
    private t(key: string, fallback: string): string {
        const loc = String(this.host?.locale || "");
        const tabla = STRINGS[loc] || STRINGS[Object.keys(STRINGS).find(l => l.slice(0, 2) === loc.slice(0, 2)) || ""];
        if (tabla && tabla[key]) return tabla[key];
        try {
            const s = this.loc?.getDisplayName(key);
            return s && s !== key ? s : fallback;
        } catch { return fallback; }
    }

    private tf(key: string, fallback: string, ...args: string[]): string {
        return this.t(key, fallback).replace(/\{(\d+)\}/g, (_m, i) => args[Number(i)] ?? "");
    }

    private static isPct(fmt: string | undefined): boolean {
        return !!fmt && /%/.test(fmt.replace(/"[^"]*"|\\./g, ""));
    }

    private formatter(format: string | undefined, scale?: number, precision?: number): valueFormatter.IValueFormatter {
        const pct = Visual.isPct(format);
        const k = (format ?? "") + "|" + (pct || scale === undefined ? "" : String(scale)) + "|" + (precision ?? "");
        let f = this.fmtCache.get(k);
        if (!f) {
            f = pct || scale === undefined
                ? valueFormatter.create({ format, cultureSelector: this.host.locale })
                : valueFormatter.create({ format, value: scale, precision, displayUnitSystemType: 2, cultureSelector: this.host.locale });
            this.fmtCache.set(k, f);
        }
        return f;
    }

    /** Valor completo con el formato del modelo (el del punto si es dinámico). */
    private fmtFull(v: Num, fmt: string | undefined): string {
        if (v === null || v === undefined || !isFinite(v)) return "";
        try { return this.formatter(fmt).format(v); } catch { return String(v); }
    }

    /** Valor compacto, 3 cifras significativas (490K, 2,06M): el último valor del minigráfico y el Δ. */
    private fmtCompact(v: number, fmt: string | undefined): string {
        const a = Math.abs(v);
        if (Visual.isPct(fmt) || a < 1000) return this.fmtFull(v, fmt);
        const unit = a >= 1e12 ? 1e12 : a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : 1e3;
        const scaled = a / unit;
        const precision = Math.max(0, Math.min(2, 3 - (Math.floor(Math.log10(Math.max(scaled, 1))) + 1)));
        // La caché va por unidad (no por valor): con el valor en la clave se creaba un formateador por celda.
        try { return this.formatter(fmt, unit, precision).format(v); } catch { return this.fmtFull(v, fmt); }
    }

    private signed(v: number, text: string): string {
        const body = text.replace(/^[-−]/, "");
        return (v > 0 ? "+" : v < 0 ? MINUS : "") + body;
    }

    private fmtPct(v: number): string {
        try {
            const s = new Intl.NumberFormat(this.host.locale || "en-US", { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(v));
            return (v > 0 ? "+" : v < 0 ? MINUS : "") + s;
        } catch { return (v > 0 ? "+" : v < 0 ? MINUS : "") + (Math.abs(v) * 100).toFixed(1) + "%"; }
    }

    private measure(text: string, size: number, bold = false, family = FONT): number {
        if (!this.canvasCtx) {
            try { this.canvasCtx = document.createElement("canvas").getContext("2d"); } catch { this.canvasCtx = null; }
        }
        if (!this.canvasCtx) return text.length * size * 0.56;
        this.canvasCtx.font = (bold ? "700 " : "") + size + "px " + family;
        return this.canvasCtx.measureText(text).width;
    }

    private periodLabel(p: number): string {
        const m = this.model;
        if (!m || p < 0 || p >= m.periods.length) return "";
        const per = m.periods[p];
        const raw = per.raw;
        const loc = this.host.locale || "en-US";
        if (raw === null && m.periods.length === 1) return this.t("UI_AllPeriods", "All periods");
        try {
            if (raw instanceof Date) {
                const monthly = m.periods.every(x => !(x.raw instanceof Date) || (x.raw as Date).getDate() === 1);
                if (monthly) return new Intl.DateTimeFormat(loc, { month: "short", year: "numeric" }).format(raw);
                return per.src?.format ? this.formatter(per.src.format).format(raw) : new Intl.DateTimeFormat(loc, { day: "numeric", month: "short", year: "numeric" }).format(raw);
            }
            const pm = periodMonth(raw);
            if (pm) return new Intl.DateTimeFormat(loc, { month: "short", year: "numeric" }).format(new Date(pm.y, pm.m - 1, 1));
            if (typeof raw === "number" && per.src?.format) return this.formatter(per.src.format).format(raw);
        } catch { /* cae al texto */ }
        return raw === null || raw === undefined ? this.t("UI_Blank", "(Blank)") : String(raw);
    }

    // ── Ajustes ──────────────────────────────────────────────────────────────

    private readSettings(dv: DataView | null): Settings {
        const o: any = dv?.metadata?.objects ?? {};
        const out: Settings = {};
        for (const obj of Object.keys(OBJECTS)) {
            out[obj] = {};
            for (const p of OBJECTS[obj].props) {
                const saved = o?.[obj]?.[p.name];
                let v: any = p.type === "fill" ? saved?.solid?.color : saved;
                if (v === undefined || v === null) v = p.def;
                if (p.type === "num") {
                    v = Number(v);
                    if (!isFinite(v)) v = p.def;
                    if (p.min !== undefined) v = Math.max(p.min, v);
                    if (p.max !== undefined) v = Math.min(p.max, v);
                }
                if (p.type === "enum" && p.items && !p.items.some(it => it[0] === v)) v = p.def;
                out[obj][p.name] = v;
            }
        }
        // "Value shows the total of the range" ES el interruptor de subtotales de columna: el host solo pide el total
        // de cada fila (subtotal de columna del motor) si el usuario lo enciende.
        out.subTotals = { columnSubtotals: o?.subTotals?.columnSubtotals === true };
        return out;
    }

    private get pal(): any { return this.host.colorPalette as any; }
    private get hc(): boolean { return !!this.pal?.isHighContrast; }
    private get hcFg(): string { return this.pal?.foreground?.value ?? "#000000"; }
    private get hcBg(): string { return this.pal?.background?.value ?? "#FFFFFF"; }
    private get hcSel(): string { return this.pal?.foregroundSelected?.value ?? this.hcFg; }

    private get canInteract(): boolean {
        if (this.formatMode) return false;
        const h: any = this.host;
        return (h?.hostCapabilities?.allowInteractions ?? h?.allowInteractions) !== false;
    }

    /** Colores del dibujo: alto contraste > ajustes del usuario > plantilla (Report theme / Classic). */
    private computeLook(): Look {
        if (this.hc) {
            const fg = this.hcFg, bg = this.hcBg;
            return { bg, text: fg, soft: fg, rule: fg, line: fg, accent: fg, up: fg, down: fg, target: fg, sub: bg, sel: bg, hover: bg, band: bg };
        }
        let base: Look;
        if (this.settings.style.template === "classic") base = { ...CLASSIC };
        else {
            const p = this.pal;
            const fg = p?.foreground?.value ?? CLASSIC.text;
            const bg = p?.background?.value ?? CLASSIC.bg;
            const accent = p?.getColor?.("Sparkline Table")?.value ?? CLASSIC.accent;
            base = {
                bg, text: fg, soft: p?.foregroundNeutralSecondary?.value ?? CLASSIC.soft,
                rule: p?.foregroundNeutralTertiary?.value ?? CLASSIC.rule, line: p?.foregroundNeutralTertiary?.value ?? CLASSIC.line,
                accent, up: p?.positive?.value ?? CLASSIC.up, down: p?.negative?.value ?? CLASSIC.down, target: fg,
                sub: mix(fg, bg, 0.035), sel: mix(accent, bg, 0.16), hover: mix(fg, bg, 0.06), band: mix(fg, bg, 0.09),
            };
        }
        const s = this.settings;
        if (s.sparkline.color) base.line = s.sparkline.color;
        if (s.sparkline.accent) { base.accent = s.sparkline.accent; base.sel = mix(base.accent, base.bg, 0.16); }
        if (s.sparkline.targetColor) base.target = s.sparkline.targetColor;
        if (s.values.upColor) base.up = s.values.upColor;
        if (s.values.downColor) base.down = s.values.downColor;
        return base;
    }

    // ── Update ───────────────────────────────────────────────────────────────

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            this.lastOptions = options;
            const dv = options.dataViews?.[0] ?? null;
            const isData = (options.type & 2) !== 0 || !this.dataView;
            this.dataView = dv;
            const vm = (options as any).viewMode;
            this.editing = typeof vm === "number" && vm !== 0;
            this.formatMode = !!(options as any).formatMode;
            this.subSelectionHelper.setFormatMode(this.formatMode);
            this.fmtCache.clear();
            // El update de datos que sigue a un toggle libera los toggles pendientes (ya vienen en el dato).
            if (isData && this.pendingToggle.size) { this.pendingToggle.clear(); this.dbg.released++; }
            if (isData) {
                // Primero se pide el siguiente segmento (antes de construir nada): si el modelo fallara, la carga sigue.
                this.handleSegments(dv, options);
                const t0 = performance.now();
                this.model = dv && dv.matrix ? buildModel(dv, (path, node, levels) => this.makeId(path, node, levels)) : null;
                this.modelMs = performance.now() - t0;
                // Calendar 1.2: el aviso de selección puede llegar ANTES que los datos. Se relee en cada update; aquí
                // son nuestras propias identidades (casan por clave), sin el respaldo equals, que es O(ids × filas).
                const cur = this.selMgr.getSelectionIds() as ISelectionId[];
                if (cur && cur.length) { this.pendingRestore = cur; this.restoreDeep = false; }
                else if (!this.pendingRestore) this.sel.clear();
                this.applyRestore();
            }
            this.render(options);
            if (this.formatMode) this.subSelectionHelper.updateOutlinesFromSubSelections((options as any).subSelections ?? [], true);
            this.events.renderingFinished(options);
            // Expandir todo: el siguiente nivel, fuera de este update.
            if (isData && this.expandChain) window.setTimeout(() => this.stepExpand(), 0);
        } catch (e) {
            // Nunca colgado: todo camino de update termina con Finished o Failed, y el fallo se ve en el visual.
            this.events.renderingFailed(options, String(e));
            console.error("[SparklineTable]", e);
            try { this.showError(String(e)); } catch { /* sin DOM */ }
        }
        // Fuera del try: un fallo de licencia nunca convierte un render correcto en renderingFailed.
        this.requestLicenseDeferred();
        try { this.notifyPro(); } catch { /* best-effort */ }
    }

    /** Repinta con las últimas options fuera de update(): no emite rendering events. */
    private repaint(): void {
        if (!this.lastOptions) return;
        try { this.render(this.lastOptions); } catch (e) { console.error("[SparklineTable]", e); }
    }

    /** Pide la licencia una vez, fuera del camino crítico (preparado para el bloque 2: hoy no hay funciones Pro). */
    private requestLicenseDeferred(): void {
        if (this.licenseRequested || this.isPro) return;
        this.licenseRequested = true;
        window.setTimeout(() => {
            try {
                const lm: any = this.host.licenseManager;
                if (!lm) { this.licenseUnsupported = true; this.licenseResolved = true; return; }
                lm.getAvailableServicePlans().then((r: any) => {
                    if (r?.isLicenseUnsupportedEnv === true || r?.isLicenseInfoAvailable === false) this.licenseUnsupported = true;
                    this.licenseResolved = true;
                    const pro = (r?.plans ?? []).some((p: any) => PLAN_IDS.some(id => matchesPlan(p.spIdentifier, id)) &&
                        (p.state === STATE_ACTIVE || p.state === STATE_WARNING));
                    if (pro) this.isPro = true;
                    // Repinta sin rendering events: con la licencia resuelta ya se sabe si toca vista previa o Pro.
                    this.repaint();
                    try { this.notifyPro(); } catch { /* best-effort */ }
                }, () => { this.licenseUnsupported = true; this.licenseResolved = true; });
            } catch { this.licenseUnsupported = true; this.licenseResolved = true; }
        }, 0);
    }

    /**
     * fetchMoreData en modo segmentos agregados, con la regla EXACTA validada en Desktop en la prueba de viabilidad
     * (A: 1.798 hojas en 671 ms; B: 10.738 hojas en 25 segmentos): en cada update de datos que traiga
     * metadata.segment se pide el siguiente; si el host dice que no, es el techo. El bloque 1 había añadido "solo si
     * llegaron filas nuevas", que no está validado y podía dejar la carga parada sin pedir el siguiente segmento.
     */
    private handleSegments(dv: DataView | null, options: VisualUpdateOptions): void {
        const ok = (options as any).operationKind as number;
        if (ok === 0) this.ceiling = false;
        const seg = (dv?.metadata as any)?.segment;
        if (!seg) { this.loading = false; return; }
        if (this.ceiling) { this.loading = false; return; }
        let more = false;
        try { more = !!this.host.fetchMoreData(true); } catch { more = false; }
        this.loading = more;
        if (!more) this.ceiling = true;
    }

    // ── Barras de fondo, expandir todo ──────────────────────────────────────

    /** Barra de fondo bajo el valor: desde cero, escala común por nivel; los negativos crecen hacia la izquierda. */
    private paintValueBar(bar: HTMLElement, d: Row): void {
        const v = d.shown[0];
        const col = this.cols.find(c => c.id === "val");
        const e = this.barExt.get(d.level);
        if (!this.settings.values.dataBars || this.hc || v === null || v === undefined || !col || !e) { bar.style.display = "none"; return; }
        const pos = Math.max(0, e[1]), neg = Math.max(0, -e[0]), tot = pos + neg || 1;
        const cw = Math.max(4, col.w - this.gap - 2);
        const left = this.gap + (v >= 0 ? neg : neg + v) / tot * cw;
        bar.style.display = "block";
        bar.style.left = left.toFixed(1) + "px";
        bar.style.width = Math.max(1, Math.abs(v) / tot * cw).toFixed(1) + "px";
        bar.classList.toggle("st-vneg", v < 0);
    }

    /**
     * Expandir todo: el host expande un nivel entero con toggleExpandCollapse(id, true) sobre un nodo contraído de ese
     * nivel. Los niveles de abajo solo existen tras su update, así que se encadena: un paso por update de datos, desde
     * un setTimeout fuera de update() (sus eventos siguen 1:1), y como mucho 3 pasos. Contraer todo = un paso en el
     * nivel 1.
     */
    private expandAll(expand: boolean): void {
        if (!this.canInteract || !this.model) return;
        if (!expand) {
            this.expandChain = null;
            const r = this.model.all.find(x => x.level === 0 && x.expandable && !x.collapsed && x.id);
            if (r && r.id) this.selMgr.toggleExpandCollapse(r.id, true);
            return;
        }
        this.expandChain = { steps: 0 };
        this.stepExpand();
    }

    private stepExpand(): void {
        const ch = this.expandChain, m = this.model;
        if (!ch || !m) return;
        const r = m.all.find(x => x.expandable && x.collapsed && !!x.id);
        if (!r || ch.steps >= 3) { this.expandChain = null; return; }
        ch.steps++;
        this.selMgr.toggleExpandCollapse(r.id as ISelectionId, true);
    }

    // ── Imagen por fila (Pro, con vista previa) ─────────────────────────────

    /** Solo imágenes embebidas: data:image/...;base64 (sin red). Una URL http(s) no se carga nunca. */
    private static okImage(s: string): boolean {
        return /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml);base64,[A-Za-z0-9+/=\s]+$/i.test(s);
    }

    /** Se dibujan con licencia o, editando y con la licencia ya resuelta, como vista previa con marca de agua. */
    private imagesOn(): boolean {
        return !!this.model && this.model.imgIdx >= 0 && this.previewOf("images");
    }

    private paintImage(name: HTMLElement, d: Row): void {
        const box = name.querySelector(".st-imgbox") as HTMLElement;
        const lv = Math.min(d.level, 2);
        const st = this.settings[lv < 0 ? "levelTotal" : "level" + (lv + 1)];
        const ok = !!d.img && Visual.okImage(d.img);
        if (!this.imagesOn() || st.image === false || !this.imgLevels.has(lv) || (!ok && !this.settings.rows.imageGap)) { box.style.display = "none"; return; }
        const size = Math.round(Number(st.imageSize) > 0 ? Math.min(Number(st.imageSize), this.rowH - 2) : Math.max(8, this.rowH - 4));
        box.style.display = "inline-block";
        box.style.width = size + "px";
        box.style.height = size + "px";
        box.classList.toggle("st-round", st.imageShape === "round");
        const svg = box.firstChild as SVGSVGElement;
        svg.setAttribute("width", String(size));
        svg.setAttribute("height", String(size));
        const img = svg.firstChild as SVGImageElement;
        if (ok) {
            if (img.getAttribute("href") !== d.img) img.setAttribute("href", d.img as string);
            img.setAttribute("width", String(size));
            img.setAttribute("height", String(size));
        } else img.removeAttribute("href");
    }

    // ── Funciones Pro: qué pide el informe, qué se dibuja, marca de agua y avisos de Power BI ─────────────────

    /** Base de la varianza (índice de valueSources) según "Compare with"; Forecast solo si se elige. -1 = sin base. */
    private varBaseIdx(m: Model | null): number {
        if (!m) return -1;
        const b = String(this.settings.variance?.base ?? "auto");
        if (b === "plan") return m.planIdx;
        if (b === "previousYear") return m.pyIdx;
        if (b === "forecast") return m.fcIdx;
        return m.planIdx >= 0 ? m.planIdx : m.pyIdx;
    }

    /** Letra de la base (PL / PY / FC) para las cabeceras ΔPL, ΔPL%. */
    private varCode(m: Model | null): string {
        const i = this.varBaseIdx(m);
        if (!m || i < 0) return "";
        return i === m.planIdx ? REF_CODES[0] : i === m.pyIdx ? REF_CODES[1] : REF_CODES[2];
    }

    /**
     * Qué funciones Pro está PIDIENDO el informe ahora (molde de Line Chart): del valor ACTUAL de cada ajuste y de los
     * pozos. Poner Plan / Prior year ES la petición de la varianza (como Small multiples en Line Chart), salvo que la
     * tarjeta esté apagada o no quede ninguna columna de varianza: entonces solo hay referencias en gris, que son gratis.
     */
    private computeProAsk(): void {
        const m = this.model, s = this.settings;
        const groups: [ProFeature, boolean, string][] = [];
        const v = s.variance || {};
        const varOn = !!m && this.varBaseIdx(m) >= 0 && v.show !== false && (!!v.showAbs || !!v.showPct || !!v.showBar);
        groups.push(["variance", varOn, "var=" + this.varCode(m)]);
        groups.push(["images", !!m && m.imgIdx >= 0, "img"]);
        const labels: ProFeature[] = [], parts: string[] = [], set = new Set<ProFeature>();
        for (const [f, on, sig] of groups) if (on) { labels.push(f); set.add(f); parts.push(sig); }
        this.proAsk = { labels, sig: parts.join("|"), set };
    }

    /** Lo que se DIBUJA, función a función: con licencia, todo; sin ella, solo la vista previa de lo que se pide. */
    private previewOf(f: ProFeature): boolean {
        if (this.isPro) return true;
        return this.proPreview && this.proAsk.set.has(f);
    }

    private featName(f: ProFeature): string {
        switch (f) {
            case "variance": return this.t("Feat_variance", "variance columns");
            case "status": return this.t("Feat_status", "status icons");
            case "sparklines": return this.t("Feat_sparklines", "extra sparkline columns");
            case "styles": return this.t("Feat_styles", "collection styles");
            case "fx": return this.t("Feat_fx", "conditional formatting");
            case "images": return this.t("Feat_images", "row images");
            case "horizon": return this.t("Feat_horizon", "horizon sparkline");
        }
        return f;
    }

    /** La marca solo editando sin licencia y con una función Pro realmente puesta: una tabla gratis no se ensucia. */
    private updateWatermark(): void {
        const labels = this.proAsk.labels;
        const on = this.proPreview && labels.length > 0 && !!this.model && this.rows.length > 0;
        if (!this.watermarkEl) {
            if (!on) return;
            this.watermarkEl = this.div("st-watermark", this.root);
            this.watermarkEl.setAttribute("aria-hidden", "true");
            this.watermarkTitle = this.div("st-wm-title", this.watermarkEl);
            this.watermarkWhy = this.div("st-wm-why", this.watermarkEl);
        }
        this.watermarkEl.style.display = on ? "flex" : "none";
        if (!on || !this.watermarkTitle || !this.watermarkWhy) return;
        this.watermarkTitle.textContent = this.t("UI_ProPreview", "Pro preview");
        const names = labels.map(f => this.featName(f));
        this.watermarkWhy.textContent = (names.length <= 2 ? names : names.slice(0, 2).concat(["+" + (names.length - 2)])).join(" · ");
        const size = Math.round(Math.max(18, Math.min(64, this.W / 10, this.H / 3.5)));
        this.watermarkEl.style.fontSize = size + "px";
        this.watermarkWhy.style.fontSize = Math.round(size * 0.36) + "px";
    }

    private cancelLicenseIcon(): void {
        if (this.licenseIconTimer !== null) { window.clearTimeout(this.licenseIconTimer); this.licenseIconTimer = null; }
    }

    private clearLicenseNotice(): void {
        this.lastBlockedNotice = "";
        this.cancelLicenseIcon();
        if (!this.licenseIconShown) return;
        this.licenseIconShown = false;
        try { (this.host.licenseManager as any)?.clearLicenseNotification?.(); } catch { /* best-effort */ }
    }

    /**
     * Avisos de licencia del propio Power BI (sin UI de licencia propia), secuencia de Line Chart / Pareto: quitar lo que
     * haya, el aviso que nombra las funciones y, ~10 s después, la barra de Upgrade. Solo ante un cambio NUEVO.
     */
    private notifyPro(): void {
        const lm: any = this.host.licenseManager;
        if (!lm || !this.licenseResolved) return;
        if (this.isPro) { this.clearLicenseNotice(); return; }
        const { labels, sig } = this.proAsk;
        if (!labels.length) { this.clearLicenseNotice(); return; }
        // Entorno sin licencias o licencia ilegible: un cliente Pro caería aquí; nunca pedirle que compre.
        if (this.licenseUnsupported) return;
        // Al pasar de lectura a edición cambia el texto (bloqueado → vista previa): también es un aviso nuevo.
        const key = sig + "|pv=" + this.proPreview;
        if (key === this.lastBlockedNotice) return;
        this.lastBlockedNotice = key;
        this.licenseIconShown = true;
        const list = labels.map(f => this.featName(f)).join(", ");
        const msg = this.proPreview
            ? this.tf("UI_NoticePreview", "Sparkline Table: {0} — part of the Pro plan, shown here as a watermarked preview. Reading view shows the free table.", list)
            : this.tf("UI_NoticeBlocked", "Sparkline Table: {0} — part of the Pro plan. Get a licence to enable it.", list);
        const show = () => {
            try { lm.notifyFeatureBlocked?.(msg.slice(0, 500)); } catch { /* best-effort */ }
            this.cancelLicenseIcon();
            this.licenseIconTimer = window.setTimeout(() => {
                this.licenseIconTimer = null;
                if (this.isPro || !this.licenseIconShown) return;
                // const enum: TypeScript lo sustituye por 0 (General).
                try { lm.notifyLicenseRequired?.(powerbi.LicenseNotificationType.General); } catch { /* best-effort */ }
            }, 10500);
        };
        let cleared: any;
        try { cleared = lm.clearLicenseNotification?.(); } catch { /* best-effort */ }
        if (cleared && typeof cleared.then === "function") cleared.then(show, show); else show();
    }

    /** Un fallo de render se ve en el visual (además de renderingFailed), nunca un spinner eterno. */
    private showError(msg: string): void {
        this.root.querySelectorAll(".st-landing").forEach(n => n.remove());
        this.message(this.tf("UI_Error", "Sparkline Table could not draw this data: {0}", msg.slice(0, 200)));
    }

    private makeId(path: DataViewMatrixNode[], node: DataViewMatrixNode, levels: DataViewHierarchyLevel[]): ISelectionId | null {
        try {
            const b = this.host.createSelectionIdBuilder();
            for (const a of path) b.withMatrixNode(a, levels);
            return b.withMatrixNode(node, levels).createSelectionId();
        } catch { return null; }
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private render(options: VisualUpdateOptions): void {
        const dv = this.dataView;
        this.settings = this.readSettings(dv);
        // Vista previa Pro: solo editando y con la licencia ya resuelta (un cliente Pro nunca ve la marca).
        this.proPreview = !this.isPro && this.editing && this.licenseResolved && !this.licenseUnsupported;
        this.computeProAsk();
        this.look = this.computeLook();
        this.computeLevelStyles();
        this.W =Math.max(0, options.viewport.width);
        this.H = Math.max(0, options.viewport.height);
        this.gen++;
        const sortSig = this.settings.rows.sortBy + "|" + this.settings.rows.sortDir;
        if (sortSig !== this.lastSettingsSort) { this.sortLocal = null; this.lastSettingsSort = sortSig; }
        this.applyLookVars();
        this.searchBar.style.display = this.settings.header.search ? "flex" : "none";
        if (!this.settings.header.search && this.query) { this.query = ""; this.searchInput.value = ""; }
        this.searchInput.placeholder = this.t("UI_Search", "Search rows…");
        this.searchInput.setAttribute("aria-label", this.searchInput.placeholder);
        this.root.querySelectorAll(".st-landing").forEach(n => n.remove());

        const m = this.model;
        const ready = !!m && m.valueIdx.length > 0 && m.levels.length > 0 && m.roots.length > 0;
        this.root.classList.toggle("st-empty", !ready);
        if (!ready) {
            this.rows = [];
            this.layer.selectAll("div.st-row").remove();
            this.spacer.style.height = "0px";
            this.totalEl.style.display = "none";
            this.notice.style.display = "none";
            while (this.header.firstChild) this.header.removeChild(this.header.firstChild);
            this.renderGuide();
            this.updateWatermark();
            if (m && m.valueIdx.length && m.levels.length && !m.roots.length) {
                this.message(this.t("UI_NoData", "No data for the current filters."));
            } else {
                this.renderLanding();
            }
            this.root.setAttribute("aria-label", "Sparkline Table by TCViz");
            return;
        }
        this.derive(m);
        this.rows = flatten(m.roots, this.comparator());
        // Buscador: solo a la vista (no filtra el informe ni se guarda). Coincidencias en cualquier nivel con su ruta.
        this.matchSet.clear();
        const q = this.settings.header.search ? norm(this.query) : "";
        if (q) {
            const keep = new Set<Row>();
            for (const r of m.all) if (norm(r.label).indexOf(q) >= 0) { this.matchSet.add(r); for (let p: Row | null = r; p; p = p.parent) keep.add(p); }
            this.rows = this.rows.filter(r => keep.has(r));
            this.rows.forEach((r, i) => { r.index = i; });
        }
        this.searchCount.textContent = q ? this.tf("UI_Matches", "{0} matches", this.int(this.matchSet.size)) : "";
        this.rowsByKey.clear();
        for (const r of this.rows) this.rowsByKey.set(r.key, r);
        this.imgUrlSeen = m.imgIdx >= 0 && m.all.some(r => !!r.img && /^https?:/i.test(r.img));
        this.imagesDrawn = this.imagesOn() && m.all.some(r => !!r.img && Visual.okImage(r.img));
        // El hueco de la imagen solo en los niveles que tienen alguna: así los nombres de esos niveles quedan alineados
        // aunque a una fila le falte, y los demás niveles no se desplazan.
        this.imgLevels.clear();
        if (this.imagesOn()) for (const r of (m.total ? m.all.concat([m.total]) : m.all)) if (r.img && Visual.okImage(r.img)) this.imgLevels.add(Math.min(r.level, 2));
        if (this.focusKey) {
            const i = this.rows.findIndex(r => r.key === this.focusKey);
            if (i >= 0) this.focusIdx = i;
        }
        if (this.focusIdx >= this.rows.length) this.focusIdx = this.rows.length - 1;
        this.layout(m);
        this.renderHeader(m);
        this.renderNotice(m);
        this.spacer.style.height = this.rows.length * this.rowH + "px";
        this.drawRows();
        this.drawTotal(m);
        this.renderGuide();
        this.markSubSelectables();
        this.updateWatermark();
        this.root.setAttribute("aria-label", "Sparkline Table by TCViz · " + m.sources[m.valueIdx[0]].displayName + " · " +
            this.tf("UI_RowsCount", "{0} rows", String(this.rows.length)));
    }

    private applyLookVars(): void {
        const L = this.look;
        const st = this.root.style;
        const set = (k: string, v: string) => st.setProperty(k, v);
        set("--st-bg", L.bg); set("--st-text", L.text); set("--st-soft", L.soft); set("--st-rule", L.rule);
        set("--st-line", L.line); set("--st-accent", L.accent); set("--st-up", L.up); set("--st-down", L.down);
        set("--st-target", L.target); set("--st-sub", L.sub); set("--st-sel", L.sel); set("--st-hover", L.hover);
        set("--st-band", L.band);
        set("--st-vbar", String(this.settings.values.barColor || L.accent));
        set("--st-vgood", this.hc ? this.hcFg : String(this.settings.variance.goodColor || L.up));
        set("--st-vbad", this.hc ? this.hcFg : String(this.settings.variance.badColor || L.down));
        const bs = this.settings.bands;
        set("--st-b1", this.hc ? "transparent" : String(bs.band1Color || "#F6CFCB"));
        set("--st-b2", this.hc ? "transparent" : String(bs.band2Color || "#FBE7B5"));
        set("--st-b3", this.hc ? "transparent" : String(bs.band3Color || "#CDE8CF")); set("--st-focus", this.hc ? this.hcSel : L.accent);
        st.background = this.hc ? this.hcBg : (this.settings.style.template === "classic" ? CLASSIC.bg : "transparent");
        this.root.classList.toggle("st-hc", this.hc);
        for (const t of ["line", "area", "column", "winloss", "bullet"]) this.root.classList.toggle("st-t-" + t, this.settings.sparkline.type === t);
        this.root.classList.toggle("st-format", this.formatMode);
    }

    /** Lo que se ve en cada fila: valor según "Value shows", Δ / Δ% contra la base, base pequeña y escalas. */
    private derive(m: Model): void {
        const s = this.settings;
        const m0 = m.valueIdx[0];
        const last = m.lastIdx;
        this.valueModeUsed = s.subTotals.columnSubtotals && m.hasTotals ? "total" : "last";
        // Base de la comparación: periodo anterior, o mismo periodo del año anterior si el eje lo permite.
        const ly = last >= 0 ? m.periods[last].ly : -1;
        this.compareUsed = s.values.compare === "lastYear" && ly >= 0 ? "lastYear" : "previous";
        this.baseIdx = last < 0 ? -1 : this.compareUsed === "lastYear" ? ly : last - 1;
        this.periodLabels = m.periods.map((_p, i) => this.periodLabel(i));
        const all = m.total ? m.all.concat([m.total]) : m.all;
        const basesByLevel = new Map<number, number[]>();
        // Referencias y varianza (bloque 2): la cifra a la vista de cada medida, del MISMO nodo del motor que el valor
        // (en un subtotal, el subtotal de Plan del motor). Nunca la suma de los hijos. Δ% con base ≤ 0 → vacío.
        const vb = this.varBaseIdx(m);
        const at = (r: Row, i: number): Num => i < 0 ? null : this.valueModeUsed === "total" ? r.tot[i] : (last >= 0 ? r.s[i][last] : null);
        this.varExt.clear();
        for (const r of all) {
            r.refs = [at(r, m.planIdx), at(r, m.pyIdx), at(r, m.fcIdx)];
            r.vref = at(r, vb);
            const real = this.valueModeUsed === "total" ? r.tot[m0] : (last >= 0 ? r.s[m0][last] : null);
            r.vabs = real !== null && r.vref !== null ? real - r.vref : null;
            r.vpct = r.vabs !== null && r.vref !== null && r.vref > 0 ? r.vabs / r.vref : null;
            if (r.vabs !== null) this.varExt.set(r.level, Math.max(this.varExt.get(r.level) ?? 0, Math.abs(r.vabs)));
        }
        for (const r of all) {
            r.shown = m.valueIdx.map(i => this.valueModeUsed === "total" ? r.tot[i] : (last >= 0 ? r.s[i][last] : null));
            r.shownFmt = m.valueIdx.map(i => this.valueModeUsed === "total" ? (r.totFmt?.[i] ?? m.sources[i].format)
                : (r.fmt?.[i]?.[last] ?? m.sources[i].format));
            r.cur = last >= 0 ? r.s[m0][last] : null;
            r.base = this.baseIdx >= 0 ? r.s[m0][this.baseIdx] : null;
            r.delta = r.cur !== null && r.base !== null ? r.cur - r.base : null;
            // Honestidad del dato: con base 0 o negativa el porcentaje no significa nada → vacío.
            r.deltaPct = r.delta !== null && r.base !== null && r.base > 0 ? r.delta / r.base : null;
            r.small = false;
            r.highlighted = !m.hasHighlights || !!(r.hl && r.hl.some(v => v !== null));
            r.spark = null;
            if (r.base !== null && r.base > 0) {
                let a = basesByLevel.get(r.level);
                if (!a) { a = []; basesByLevel.set(r.level, a); }
                a.push(r.base);
            }
        }
        // Δ% sobre base pequeña (regla en PRUEBA-BLOQUE1.md): |base| < umbral % × mediana de |base| del mismo nivel.
        const thr = Number(s.values.smallBase) / 100;
        if (thr > 0) {
            const med = new Map<number, number>();
            basesByLevel.forEach((a, lv) => { a.sort((x, y) => x - y); med.set(lv, a[a.length >> 1]); });
            for (const r of all) {
                const md = med.get(r.level);
                if (r.deltaPct !== null && md !== undefined && Math.abs(r.base as number) < thr * md) r.small = true;
            }
        }
        // Escalas por nivel (la común por defecto): un subtotal no aplasta a sus hijos.
        this.ext.clear(); this.extBullet.clear(); this.barExt.clear();
        for (const r of all) {
            const v = r.shown[0];
            if (v === null || v === undefined) continue;
            const e = this.barExt.get(r.level) ?? [0, 0];
            if (v < e[0]) e[0] = v; if (v > e[1]) e[1] = v;
            this.barExt.set(r.level, e);
        }
        const tg = this.showTarget(m) ? m.targetIdx : -1;
        for (const r of all) {
            const e = this.ext.get(r.level) ?? [Infinity, -Infinity];
            const scan = (arr: Num[]) => { for (const v of arr) if (v !== null) { if (v < e[0]) e[0] = v; if (v > e[1]) e[1] = v; } };
            scan(r.s[m0]);
            if (tg >= 0) scan(r.s[tg]);
            this.ext.set(r.level, e);
            const b = this.extBullet.get(r.level) ?? [0, 0];
            const bt = this.bulletTarget(r, m);
            // Con bandas, un 10 % de aire sobre el objetivo para que se vea la banda buena.
            for (const v of [r.shown[0], bt, bt !== null && this.bandEdges(bt, m) ? bt * 1.1 : null]) if (v !== null && v !== undefined) { if (v < b[0]) b[0] = v; if (v > b[1]) b[1] = v; }
            this.extBullet.set(r.level, b);
        }
    }

    private showTarget(m: Model): boolean { return m.targetIdx >= 0 && this.settings.sparkline.target !== false; }

    private bulletTarget(r: Row, m: Model): Num {
        if (m.targetIdx < 0) return null;
        return this.valueModeUsed === "total" ? r.tot[m.targetIdx] : (m.lastIdx >= 0 ? r.s[m.targetIdx][m.lastIdx] : null);
    }

    private effectiveSort(): { by: string; dir: string } {
        return this.sortLocal ?? { by: String(this.settings.rows.sortBy), dir: String(this.settings.rows.sortDir) };
    }

    /** Ordenar por la cifra que se VE (valor según "Value shows", Δ, Δ%); los vacíos siempre al final. */
    private comparator(): ((a: Row, b: Row) => number) | null {
        const { by, dir } = this.effectiveSort();
        if (by === "host") return null;
        const sign = dir === "asc" ? 1 : -1;
        if (by === "name") {
            const coll = new Intl.Collator(this.host.locale || "en-US", { numeric: true, sensitivity: "base" });
            return (a, b) => sign * coll.compare(a.label, b.label);
        }
        const key = (r: Row): Num => by === "value" ? r.shown[0] : by === "value2" ? (r.shown[1] ?? null) : by === "value3" ? (r.shown[2] ?? null)
            : by === "delta" ? r.delta : by === "deltaPct" ? r.deltaPct
            : by === "varAbs" ? (this.previewOf("variance") ? r.vabs : null) : by === "varPct" ? (this.previewOf("variance") ? r.vpct : null) : null;
        return (a, b) => {
            const x = key(a), y = key(b);
            if (x === null && y === null) return 0;
            if (x === null) return 1;
            if (y === null) return -1;
            return sign * (x - y);
        };
    }

    // ── Layout por tamaño ────────────────────────────────────────────────────

    private layout(m: Model): void {
        const s = this.settings;
        const fs = Number(s.values.fontSize);
        const nfs = Number(s.rows.fontSize);
        const dens = String(s.rows.density);
        // El alto de fila es fijo para todas (lo exige la virtualización): sale del texto más grande en uso.
        let base = Math.max(fs, nfs);
        this.levelStyles.forEach(st => { if (st.fs > base) base = st.fs; });
        const auto = dens === "compact" ? Math.max(18, base + 7) : dens === "comfortable" ? Math.max(30, base + 19) : Math.max(22, base + 11);
        // Row height (0 = el de la densidad). Si es más bajo que el texto, manda el texto: mínimo texto + 4 px.
        const askH = Number(s.rows.rowHeight);
        this.rowH = askH > 0 ? Math.max(16, Math.round(askH), Math.ceil(base + 4)) : auto;
        this.rowHClamped = askH > 0 && this.rowH > askH;
        this.root.style.setProperty("--st-rh", this.rowH + "px");
        this.root.style.setProperty("--st-fs", nfs + "px");
        this.root.style.setProperty("--st-vfs", fs + "px");
        this.root.style.setProperty("--st-hfs", Number(s.header.fontSize) + "px");
        this.root.style.setProperty("--st-indent", Number(s.rows.indent) + "px");

        // Hueco entre columnas (Column spacing, mínimo 12 px): va a la izquierda de cada columna numérica, así el
        // texto alineado a la derecha nunca toca la columna anterior.
        const gap = Math.max(12, Number(s.rows.colSpacing));
        this.gap = gap;
        this.root.style.setProperty("--st-gap", gap + "px");
        // Anchos medidos con la fuente REAL de cada nivel (tamaño, familia, negrita), del total y de la cabecera; el
        // máximo de todos. Solo se formatean los extremos de cada nivel (no 12.000 valores).
        const all = m.total ? m.all.concat([m.total]) : m.all;
        const nV = m.valueIdx.length;
        type Ext = { v: [number, number][]; d: [number, number]; r: [number, number][]; va: [number, number] };
        const byLv = new Map<number, Ext>();
        const upd = (e: [number, number], x: Num | undefined) => { if (x !== null && x !== undefined) { if (x < e[0]) e[0] = x; if (x > e[1]) e[1] = x; } };
        const nE = (): [number, number] => [Infinity, -Infinity];
        for (const r of all) {
            const lv = Math.min(r.level, 2);
            let e = byLv.get(lv);
            if (!e) { e = { v: m.valueIdx.map(nE), d: nE(), r: [nE(), nE(), nE()], va: nE() }; byLv.set(lv, e); }
            for (let k = 0; k < nV; k++) upd(e.v[k], r.shown[k]);
            upd(e.d, r.delta);
            for (let k = 0; k < 3; k++) upd(e.r[k], r.refs[k]);
            upd(e.va, r.vabs);
        }
        const refIdx = [m.planIdx, m.pyIdx, m.fcIdx];
        const refW: number[] = [0, 0, 0];
        let vaText = 0;
        const fmtD = (v: number) => this.signed(v, this.fmtCompact(v, m.sources[m.valueIdx[0]].format));
        const textW: number[] = m.valueIdx.map(() => 0);
        let dText = 0, pText = 0;
        byLv.forEach((e, lv) => {
            const st = this.levelStyles.get(lv);
            const size = st && st.fs ? st.fs : fs;
            const fam = st && st.ff ? st.ff : FONT;
            const bw = st ? st.bold : "auto";
            const ext2 = (x: [number, number], f: (v: number) => string, bold: boolean) =>
                isFinite(x[0]) ? Math.max(this.measure(f(x[0]), size, bold, fam), this.measure(f(x[1]), size, bold, fam)) : 0;
            for (let k = 0; k < nV; k++) {
                const bold = bw === "on" || (bw === "auto" && (k === 0 || lv < 0));
                textW[k] = Math.max(textW[k], ext2(e.v[k], v => this.fmtFull(v, m.sources[m.valueIdx[k]].format), bold));
            }
            dText = Math.max(dText, ext2(e.d, fmtD, bw === "on"));
            pText = Math.max(pText, this.measure(this.fmtPct(-9.999), size, bw === "on", fam));
            for (let k = 0; k < 3; k++) if (refIdx[k] >= 0) refW[k] = Math.max(refW[k], ext2(e.r[k], v => this.fmtFull(v, m.sources[refIdx[k]].format), bw === "on"));
            vaText = Math.max(vaText, ext2(e.va, fmtD, bw === "on"));
        });
        const hFam = s.header.fontFamily ? String(s.header.fontFamily) : FONT;
        const hdrW = (txt: string) => this.measure(txt, Number(s.header.fontSize), s.header.bold !== false, hFam) + gap;
        const valW = (k: number) => Math.min(240, Math.max(Math.ceil(textW[k]) + gap, Math.min(150, hdrW(m.sources[m.valueIdx[k]].displayName))));
        const dW = Math.min(160, Math.max(Math.ceil(dText) + gap, hdrW("Δ")));
        const pW = Math.max(Math.ceil(pText) + gap, hdrW("Δ%"));

        const want: Col[] = [{ id: "name", w: 0, sortKey: "name" }];
        want.push({ id: "val", w: valW(0), sortKey: "value" });
        if (s.values.showDelta) want.push({ id: "delta", w: dW, sortKey: "delta" });
        if (s.values.showDeltaPct) want.push({ id: "pct", w: pW, sortKey: "deltaPct" });
        if (m.valueIdx.length > 1) want.push({ id: "m2", w: valW(1), sortKey: "value2" });
        if (m.valueIdx.length > 2) want.push({ id: "m3", w: valW(2), sortKey: "value3" });
        // Referencias (gris; también en el gratis: el lector sin licencia las ve, no un hueco) y varianza (Pro).
        const refOn = s.variance.showReference !== false;
        REF_COLS.forEach((id, k) => {
            if (refOn && refIdx[k] >= 0) want.push({ id, w: Math.min(240, Math.max(Math.ceil(refW[k]) + gap, Math.min(150, hdrW(m.sources[refIdx[k]].displayName)))), sortKey: null });
        });
        const varOn = this.previewOf("variance") && this.varBaseIdx(m) >= 0 && s.variance.show !== false;
        const code = this.varCode(m);
        if (varOn && s.variance.showAbs) want.push({ id: "vabs", w: Math.min(160, Math.max(Math.ceil(vaText) + gap, hdrW("Δ" + code))), sortKey: "varAbs" });
        if (varOn && s.variance.showBar) want.push({ id: "vbar", w: Math.round(Math.max(56, Math.min(110, this.W * 0.09))) + gap, sortKey: null });
        if (varOn && s.variance.showPct) want.push({ id: "vpct", w: Math.max(Math.ceil(pText) + gap, hdrW("Δ" + code + "%")), sortKey: "varPct" });

        // Último valor dentro del minigráfico
        const fmt0 = m.sources[m.valueIdx[0]].format;
        const lastVals = all.map(r => { const sr = r.s[m.valueIdx[0]]; for (let p = sr.length - 1; p >= 0; p--) if (sr[p] !== null) return sr[p]; return null; });
        const showLast = s.sparkline.showLast !== false && s.sparkline.type !== "winloss";
        const lv = [Infinity, -Infinity];
        for (const v of lastVals) if (v !== null) { if (v < lv[0]) lv[0] = v; if (v > lv[1]) lv[1] = v; }
        const lblFs = Math.max(7, Math.min(fs - 1, Math.round(this.rowH * 0.55)));
        const lblW = isFinite(lv[0]) ? Math.max(this.measure(this.fmtCompact(lv[0], fmt0), lblFs), this.measure(this.fmtCompact(lv[1], fmt0), lblFs)) : 0;
        this.labelW = showLast ? Math.min(72, Math.ceil(lblW) + 6) : 0;

        // Primero el minigráfico (lo que define el producto), luego el nombre; los adornos cogen lo que sobra, y se
        // quitan en este orden: minigráficos 3 y 2, medidas 3 y 2, Forecast y Prior year, Δ, Δ%, estado, Plan, la
        // varianza (barra, Δ, Δ%) y el valor. El primer minigráfico nunca.
        const W = this.W - 2 - (this.scroller.offsetWidth - this.scroller.clientWidth || 0);
        const nameMin = Math.min(150, Math.max(64, this.W * 0.18));
        let spark = Math.max(56, Math.min(220, this.W * 0.3));
        const dropOrder: ColId[] = ["spark3", "spark2", "m3", "m2", "fc", "py", "delta", "pct", "stat", "pl", "vbar", "vabs", "vpct", "val"];
        const sum = () => want.reduce((a, c) => a + c.w, 0) + gap + PAD;
        for (const id of dropOrder) {
            if (sum() + nameMin + spark + this.labelW <= W) break;
            const i = want.findIndex(c => c.id === id);
            if (i >= 0) want.splice(i, 1);
        }
        if (sum() + nameMin + spark + this.labelW > W) {
            spark = Math.max(40, W - sum() - nameMin - this.labelW);
            if (spark < 56 && this.labelW) { this.labelW = 0; spark = Math.max(40, W - sum() - nameMin); }
        }
        this.sparkW = Math.floor(spark);
        want.push({ id: "spark", w: this.sparkW + this.labelW + gap + PAD, sortKey: null });
        want.sort((a, b) => COL_ORDER.indexOf(a.id) - COL_ORDER.indexOf(b.id));
        this.cols = want;
        const tpl = want.map(c => c.id === "name" ? "minmax(0,1fr)" : c.w.toFixed(0) + "px").join(" ");
        this.root.style.setProperty("--st-cols", tpl);
        const has = (id: ColId) => want.some(c => c.id === id);
        for (const id of OPTIONAL_COLS) this.root.classList.toggle("st-hide-" + id, !has(id));
    }

    // ── Cabecera ─────────────────────────────────────────────────────────────

    private renderHeader(m: Model): void {
        const h = this.header;
        while (h.firstChild) h.removeChild(h.firstChild);
        const s = this.settings;
        h.style.display = s.header.show ? "grid" : "none";
        if (!s.header.show) return;
        // Cabecera con su propio formato (alto contraste ignora fondo y color).
        h.style.fontFamily = s.header.fontFamily ? String(s.header.fontFamily) : "";
        h.style.color = !this.hc && s.header.color ? String(s.header.color) : "";
        h.style.background = !this.hc && s.header.background ? String(s.header.background) : "";
        h.classList.toggle("st-h-normal", s.header.bold === false);
        h.style.minHeight = this.rowH + "px";
        const twoLines = s.header.context !== false && this.H >= 150;
        const { by, dir } = this.effectiveSort();
        const lastLbl = this.periodLabels[m.lastIdx] ?? "";
        const baseLbl = this.periodLabels[this.baseIdx] ?? "";
        const valCtx = this.valueModeUsed === "total" ? this.t("UI_Total", "Total") : lastLbl;
        const dCtx = this.baseIdx < 0 ? "" : (this.valueModeUsed === "total" ? lastLbl + " " : "") + this.tf("UI_Vs", "vs {0}", baseLbl);
        const vbi = this.varBaseIdx(m);
        const varCtx = vbi < 0 ? "" : this.tf("UI_Vs", "vs {0}", m.sources[vbi].displayName);
        const levelNames = m.levels.map(l => l.sources.map(x => x.displayName).join(" + ")).join(" › ");
        const sortName = this.sortName(by);
        const nameCtx = by === "host" ? this.hostSortText() : this.tf("UI_SortedBy", "Sorted by {0} {1}", sortName, dir === "asc" ? "↑" : "↓");
        const type = String(s.sparkline.type);
        let sparkCtx = m.periods.length > 1 ? this.periodLabels[0] + " – " + this.periodLabels[m.periods.length - 1] : (this.periodLabels[0] ?? "");
        // Bullet: una barra con la cifra de la columna de valor (no la serie); win/loss: contra el objetivo o contra cero.
        if (type === "bullet") sparkCtx = valCtx;
        if (type === "winloss") sparkCtx += " · " + this.tf("UI_Vs", "vs {0}", this.showTarget(m) ? m.sources[m.targetIdx].displayName : "0");
        const scaleNote = type === "winloss" ? "" : s.sparkline.scale === "row" ? this.t("UI_ScalePerRow", "Scale: per row")
            : s.sparkline.scale === "auto" ? this.t("UI_ScalePerRowDetail", "Scale: per row in detail rows") : "";
        const sparkTitle = s.sparkline.type === "bullet" && m.targetIdx >= 0
            ? m.sources[m.valueIdx[0]].displayName + " / " + m.sources[m.targetIdx].displayName
            : this.typeName(String(s.sparkline.type)) + " · " + m.sources[m.valueIdx[0]].displayName;
        const titles: Record<ColId, [string, string]> = {
            name: [levelNames, nameCtx],
            val: [m.sources[m.valueIdx[0]].displayName, valCtx],
            delta: ["Δ", dCtx],
            pct: ["Δ%", dCtx],
            m2: [m.valueIdx[1] !== undefined ? m.sources[m.valueIdx[1]].displayName : "", valCtx],
            m3: [m.valueIdx[2] !== undefined ? m.sources[m.valueIdx[2]].displayName : "", valCtx],
            spark: [sparkTitle, sparkCtx],
            pl: [m.planIdx >= 0 ? m.sources[m.planIdx].displayName : "", valCtx],
            py: [m.pyIdx >= 0 ? m.sources[m.pyIdx].displayName : "", valCtx],
            fc: [m.fcIdx >= 0 ? m.sources[m.fcIdx].displayName : "", valCtx],
            vabs: ["Δ" + this.varCode(m), varCtx],
            vbar: [this.cols.some(c => c.id === "vabs") ? "" : "Δ" + this.varCode(m), varCtx],
            vpct: ["Δ" + this.varCode(m) + "%", varCtx],
            stat: ["", ""],
            spark2: ["", ""],
            spark3: ["", ""],
        };
        // Segunda línea compartida: Δ y Δ% (vs el periodo base) y la varianza (vs la referencia) ocupan sus columnas.
        const group = (id: ColId): string => id === "delta" || id === "pct" ? "chg" : id === "vabs" || id === "vbar" || id === "vpct" ? "var" : id;
        const span = this.cols.map((c, i) => {
            if (i > 0 && group(this.cols[i - 1].id) === group(c.id)) return 0;
            let n = 1;
            while (i + n < this.cols.length && group(this.cols[i + n].id) === group(c.id)) n++;
            return n;
        });
        this.cols.forEach((c, i) => {
            const [t1, t2] = titles[c.id];
            const cell = this.div("st-h st-h-" + c.id, h);
            cell.style.gridColumn = String(i + 1);
            cell.style.gridRow = "1";
            cell.setAttribute("role", "columnheader");
            const sorted = c.sortKey !== null && c.sortKey === by;
            const label = this.div("st-h1", cell);
            // Una sola línea: "Ventas netas · sep 2026"
            label.textContent = (twoLines || !t2 || !span[i] || c.id === "name" || c.id === "spark" ? t1 : (t1 ? t1 + " · " : "") + t2) + (sorted ? (dir === "asc" ? " ↑" : " ↓") : "");
            if (c.id === "name" && s.header.expandButtons !== false && this.canInteract && m.levels.length > 1) {
                // Expandir / contraer todo (lo guarda el host). Cada botón para la propagación: el clic en la cabecera ordena.
                const box = this.div("st-xbtns", cell);
                const btn = (txt: string, tip: string, fn: () => void) => {
                    const b = document.createElement("button");
                    b.type = "button"; b.className = "st-xbtn"; b.textContent = txt; b.title = tip; b.setAttribute("aria-label", tip);
                    b.addEventListener("pointerdown", ev => ev.stopPropagation());
                    b.addEventListener("click", ev => { ev.stopPropagation(); fn(); });
                    box.appendChild(b);
                };
                btn("⊞", this.t("UI_ExpandAll", "Expand all"), () => this.expandAll(true));
                btn("⊟", this.t("UI_CollapseAll", "Collapse all"), () => this.expandAll(false));
            }
            cell.title = t1 + (t2 ? " · " + t2 : "") + (c.id === "spark" && scaleNote ? " · " + scaleNote : "");
            if (c.sortKey) {
                cell.classList.add("st-sortable");
                cell.setAttribute("aria-sort", sorted ? (dir === "asc" ? "ascending" : "descending") : "none");
                cell.addEventListener("click", (e) => { e.stopPropagation(); this.onHeaderSort(c.sortKey as string); });
            }
            if (!twoLines) {
                // Escala por fila: siempre rotulada, también con la cabecera de una línea.
                if (c.id === "spark" && scaleNote) { const sc = document.createElement("span"); sc.className = "st-scale"; sc.textContent = " · " + scaleNote; label.appendChild(sc); }
                return;
            }
            // Segunda línea: el contexto, una vez por grupo (Δ y Δ%; la varianza).
            if (!span[i]) return;
            const ctx = this.div("st-h2 st-h2-" + c.id, h);
            ctx.textContent = t2;
            if (c.id === "spark" && scaleNote) { const sc = document.createElement("span"); sc.className = "st-scale"; sc.textContent = " · " + scaleNote; ctx.appendChild(sc); }
            ctx.style.gridRow = "2";
            ctx.style.gridColumn = (i + 1) + (span[i] > 1 ? " / span " + span[i] : "");
            if (c.id === "name" && by === "host" && this.hostSortText() !== "") ctx.classList.add("st-h2-host");
        });
    }

    private sortName(by: string): string {
        const m = this.model;
        switch (by) {
            case "name": return this.t("Enum_sortBy_name", "Name");
            case "value": return m ? m.sources[m.valueIdx[0]].displayName : "";
            case "value2": return m && m.valueIdx[1] !== undefined ? m.sources[m.valueIdx[1]].displayName : "";
            case "value3": return m && m.valueIdx[2] !== undefined ? m.sources[m.valueIdx[2]].displayName : "";
            case "delta": return "Δ";
            case "deltaPct": return "Δ%";
            case "varAbs": return "Δ" + this.varCode(m);
            case "varPct": return "Δ" + this.varCode(m) + "%";
        }
        return "";
    }

    /** Si manda el orden del host (menú … → Ordenar por), se rotula: ordena por el total, no por la cifra visible. */
    private hostSortText(): string {
        const cols = (this.dataView?.metadata?.columns || []).filter(c => c.sort !== undefined && c.sort !== null);
        if (!cols.length) return "";
        cols.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const c = cols[0];
        const arrow = c.sort === 1 ? "↑" : "↓";
        return c.isMeasure
            ? this.tf("UI_HostSortMeasure", "Power BI order: {0} {1} (whole range)", c.displayName, arrow)
            : this.tf("UI_HostSort", "Power BI order: {0} {1}", c.displayName, arrow);
    }

    private typeName(t: string): string {
        const it = OBJECTS.sparkline.props.find(p => p.name === "type")?.items?.find(x => x[0] === t);
        return it ? this.t(it[1], it[2]) : t;
    }

    /** Clic en una cabecera: descendente → ascendente → orden de Power BI. Local al momento; editando se guarda. */
    private onHeaderSort(key: string): void {
        if (!this.canInteract || !this.model) return;
        const cur = this.effectiveSort();
        const next = cur.by !== key ? { by: key, dir: key === "name" ? "asc" : "desc" }
            : (cur.dir === (key === "name" ? "asc" : "desc") ? { by: key, dir: key === "name" ? "desc" : "asc" } : { by: "host", dir: "desc" });
        this.sortLocal = next;
        if (this.editing) this.persistir("rows", { sortBy: next.by, sortDir: next.dir });
        this.repaint();
    }

    // ── Avisos ───────────────────────────────────────────────────────────────

    private renderNotice(m: Model): void {
        const msgs: { t: string; warn: boolean }[] = [];
        if (this.loading) msgs.push({ t: this.tf("UI_Loading", "Loading {0} of …", this.int(m.all.length)), warn: false });
        if (this.ceiling) msgs.push({ t: this.tf("UI_Ceiling", "Row limit reached: showing {0} rows. Filter or collapse levels to see the rest.", this.int(m.all.length)), warn: true });
        // Jerarquía a medias (lección 2 de la prueba): el host mandó menos niveles de los que hay en el pozo, o el último
        // nivel recibido aún se puede expandir.
        const shownLevels = m.levels.length;
        const total = Math.min(3, Math.max(m.rowFields, shownLevels + (m.lastLevelExpandable ? 1 : 0)));
        if (total > shownLevels) {
            msgs.push({ t: this.tf("UI_Levels", "Showing {0} of {1} levels: use ▸ to open the next one.", String(shownLevels), String(total)), warn: false });
        }
        if (m.periods.length >= 400) msgs.push({ t: this.t("UI_PeriodCap", "Only the first 400 periods are drawn."), warn: false });
        // Sin red: una URL en Row image no se carga; editando se avisa de cómo hacerlo.
        if (this.editing && this.imgUrlSeen) msgs.push({ t: this.t("UI_ImgEmbedded", "Images must be embedded (Base64 data URI): web links are not loaded."), warn: true });
        if (this.settings.values.compare === "lastYear" && this.compareUsed !== "lastYear") {
            msgs.push({ t: this.t("UI_NoLastYear", "Same period last year is not available on this axis: compared with the previous period."), warn: false });
        }
        if (this.settings.subTotals.columnSubtotals && this.valueModeUsed !== "total") {
            msgs.push({ t: this.t("UI_NoTotal", "Total of the range did not arrive from Power BI: showing the last period."), warn: false });
        }
        const show = msgs.length > 0 && this.H >= 90;
        this.notice.style.display = show ? "block" : "none";
        this.notice.textContent = show ? msgs.map(x => x.t).join("  ·  ") : "";
        this.notice.classList.toggle("st-warn", msgs.some(x => x.warn));
        this.notice.title = this.notice.textContent;
        this.notice.setAttribute("role", "status");
    }

    private int(n: number): string {
        try { return new Intl.NumberFormat(this.host.locale || "en-US").format(n); } catch { return String(n); }
    }

    // ── Filas (virtualizadas) ────────────────────────────────────────────────

    private buildRowCells(rowSel: Selection<any, any, any, any>): void {
        const name = rowSel.append("div").attr("class", "st-c st-c-name").attr("role", "gridcell");
        name.append("span").attr("class", "st-toggle").attr("aria-hidden", "true");
        const ib = name.append("span").attr("class", "st-imgbox").attr("aria-hidden", "true").style("display", "none");
        ib.append("svg").append("image").attr("preserveAspectRatio", "xMidYMid slice");
        name.append("span").attr("class", "st-label");
        // Celda de valor: la barra de fondo (Data bars) debajo y el texto encima.
        const val = rowSel.append("div").attr("class", "st-c st-c-val").attr("role", "gridcell");
        val.append("span").attr("class", "st-vbar").attr("aria-hidden", "true");
        val.append("span").attr("class", "st-vtext");
        // Mismo orden que COL_ORDER: la rejilla coloca las celdas por orden y las ocultas (st-hide-*) no ocupan.
        for (const c of ["delta", "pct", "pl", "py", "fc", "vabs"]) rowSel.append("div").attr("class", "st-c st-c-" + c + (c === "pl" || c === "py" || c === "fc" ? " st-ref" : "")).attr("role", "gridcell");
        const vb = rowSel.append("div").attr("class", "st-c st-c-vbar").attr("role", "gridcell");
        vb.append("span").attr("class", "st-vb-axis").attr("aria-hidden", "true");
        vb.append("span").attr("class", "st-vb-bar").attr("aria-hidden", "true");
        for (const c of ["vpct", "stat", "m2", "m3"]) rowSel.append("div").attr("class", "st-c st-c-" + c).attr("role", "gridcell");
        const sp = rowSel.append("div").attr("class", "st-c st-c-spark").attr("role", "gridcell");
        const svg = sp.append("svg").attr("class", "st-svg").attr("aria-hidden", "true");
        for (const c of ["st-b1", "st-b2", "st-b3", "st-band", "st-area", "st-pos", "st-neg", "st-tgt", "st-line", "st-mk-neg", "st-mk-first", "st-mk-max", "st-mk-min", "st-mk-last", "st-hover"]) {
            svg.append("path").attr("class", c);
        }
        svg.append("text").attr("class", "st-lastlbl");
    }

    private drawRows(): void {
        const m = this.model;
        if (!m || !this.rows.length) return;
        const rows = this.rows;
        const RH = this.rowH;
        const top = this.scroller.scrollTop;
        const viewH = this.scroller.clientHeight || this.H;
        const start = Math.max(0, Math.floor(top / RH) - MARGIN_ROWS);
        const end = Math.min(rows.length, Math.ceil((top + viewH) / RH) + MARGIN_ROWS);
        const slice = rows.slice(start, end);
        const sel = this.layer.selectAll<HTMLDivElement, Row>("div.st-row").data(slice, (d: Row) => d.key);
        sel.exit().remove();
        const enter = sel.enter().append("div").attr("class", "st-row").attr("role", "row");
        this.buildRowCells(enter);
        // Sin manejadores por fila: los delegados de la capa (constructor) resuelven la fila por su CLAVE en el momento
        // del gesto. La virtualización recicla nodos y un cierre viejo podía apuntar a otra fila.
        const all = enter.merge(sel);
        const anySel = this.sel.size > 0;
        all.each((d: Row, i: number, nodes: HTMLDivElement[]) => this.paintRow(nodes[i], d, anySel));
    }

    private paintRow(el: HTMLDivElement, d: Row, anySel: boolean): void {
        const m = this.model as Model;
        const selected = anySel && this.isSelected(d);
        el.setAttribute("data-i", String(d.index));
        el.setAttribute("data-key", d.key);
        el.id = "st-r-" + d.index;
        el.style.transform = "translateY(" + d.index * this.rowH + "px)";
        el.className = "st-row" + (d.isLeaf ? "" : " st-subtotal") + (selected ? " st-selected" : "") + (this.matchSet.has(d) ? " st-match" : "") +
            (!d.highlighted ? " st-dim" : "") + (this.hasFocus && this.kbFocus && d.index === this.focusIdx ? " st-focus" : "") + " st-l" + Math.min(d.level, 3);
        el.setAttribute("aria-level", String(d.level + 1));
        el.setAttribute("aria-selected", String(selected));
        if (d.expandable) el.setAttribute("aria-expanded", String(!d.collapsed)); else el.removeAttribute("aria-expanded");
        this.fillCells(el, d, m);
    }

    /** Formato del nivel de la fila (Row levels). Vacío = lo de siempre (CSS: subtotal con fondo suave y negrita). */
    private applyLevelStyle(el: HTMLElement, d: Row): void {
        const st = this.levelStyles.get(Math.min(d.level, 2));
        const es = el.style;
        es.background = st && st.bg && !el.classList.contains("st-selected") ? st.bg : "";
        es.color = st && st.color ? st.color : "";
        es.fontFamily = st && st.ff ? st.ff : "";
        es.fontStyle = st && st.italic ? "italic" : "";
        if (st && st.fs) { es.fontSize = st.fs + "px"; es.setProperty("--st-vfs", st.fs + "px"); }
        else { es.fontSize = ""; es.removeProperty("--st-vfs"); }
        const bw = st ? st.bold : "auto";
        el.classList.toggle("st-bw", bw !== "auto");
        es.fontWeight = bw === "on" ? "700" : bw === "off" ? "400" : "";
    }

    private fillCells(el: HTMLElement, d: Row, m: Model): void {
        const s = this.settings;
        this.applyLevelStyle(el, d);
        const q = (c: string) => el.querySelector(c) as HTMLElement;
        const name = q(".st-c-name");
        name.style.paddingLeft = (PAD + Math.max(0, d.level) * Number(s.rows.indent)) + "px";
        const tg = q(".st-toggle");
        // Toggle pendiente (pedido al host, aún sin update): el triángulo cambia en el acto, atenuado.
        const pend = this.pendingToggle.has(d.key);
        tg.textContent = d.expandable ? ((pend ? !d.collapsed : d.collapsed) ? "▸" : "▾") : "";
        tg.classList.toggle("st-can", d.expandable && this.canInteract);
        tg.classList.toggle("st-pending", pend);
        name.classList.toggle("st-can-toggle", d.expandable && this.canInteract && d.level >= 0);
        this.paintImage(name, d);
        q(".st-label").textContent = d.level < 0 ? this.t("UI_GrandTotal", "Total") : d.label;
        const fmt0 = d.shownFmt[0];
        q(".st-c-val .st-vtext").textContent = this.fmtFull(d.shown[0] ?? null, fmt0);
        this.paintValueBar(q(".st-c-val .st-vbar"), d);
        const up = s.values.invert ? "st-bad" : "st-good", down = s.values.invert ? "st-good" : "st-bad";
        const dc = q(".st-c-delta");
        dc.textContent = d.delta === null ? "" : this.signed(d.delta, this.fmtCompact(d.delta, d.shownFmt[0] && this.valueModeUsed === "last" ? fmt0 : m.sources[m.valueIdx[0]].format));
        dc.className = "st-c st-c-delta" + (d.delta === null || d.delta === 0 ? "" : " " + (d.delta > 0 ? up : down));
        const pc = q(".st-c-pct");
        pc.textContent = d.deltaPct === null ? "" : this.fmtPct(d.deltaPct);
        pc.className = "st-c st-c-pct" + (d.deltaPct === null || d.deltaPct === 0 ? "" : " " + (d.deltaPct > 0 ? up : down)) + (d.small ? " st-small" : "");
        q(".st-c-m2").textContent = m.valueIdx.length > 1 ? this.fmtFull(d.shown[1] ?? null, d.shownFmt[1]) : "";
        q(".st-c-m3").textContent = m.valueIdx.length > 2 ? this.fmtFull(d.shown[2] ?? null, d.shownFmt[2]) : "";
        // Referencias (gris, también en el gratis), con el formato del modelo (el del punto si es dinámico).
        const refIdx = [m.planIdx, m.pyIdx, m.fcIdx];
        REF_COLS.forEach((id, k) => {
            const i = refIdx[k];
            q(".st-c-" + id).textContent = i < 0 ? "" : this.fmtFull(d.refs[k], this.valueModeUsed === "total" ? (d.totFmt?.[i] ?? m.sources[i].format)
                : (d.fmt?.[i]?.[m.lastIdx] ?? m.sources[i].format));
        });
        // Varianza contra la base (Pro): verde/rojo según "A decrease is good".
        if (this.cols.some(c => c.id === "vabs" || c.id === "vbar" || c.id === "vpct")) {
            const fav = d.vabs === null || d.vabs === 0 ? "" : ((d.vabs > 0) !== !!s.values.invert ? " st-vgood" : " st-vbad");
            const va = q(".st-c-vabs");
            va.textContent = d.vabs === null ? "" : this.signed(d.vabs, this.fmtCompact(d.vabs, m.sources[m.valueIdx[0]].format));
            va.className = "st-c st-c-vabs" + fav;
            const vp = q(".st-c-vpct");
            vp.textContent = d.vpct === null ? "" : this.fmtPct(d.vpct);
            vp.className = "st-c st-c-vpct" + fav;
            this.paintVarBar(q(".st-c-vbar"), d, fav);
        }
        this.paintSpark(el, d, m);
    }

    /** Barra de varianza: eje en cero en el centro, favorable a la derecha si sube; escala común por nivel. */
    private paintVarBar(cell: HTMLElement, d: Row, fav: string): void {
        const axis = cell.querySelector(".st-vb-axis") as HTMLElement, bar = cell.querySelector(".st-vb-bar") as HTMLElement;
        const col = this.cols.find(c => c.id === "vbar");
        if (!col) return;
        const mx = this.varExt.get(d.level) ?? 0;
        const cw = Math.max(8, col.w - this.gap - 4);
        const mid = this.gap + cw / 2;
        axis.style.left = mid.toFixed(1) + "px";
        if (d.vabs === null || !(mx > 0)) { bar.style.display = "none"; return; }
        const len = Math.max(1, Math.abs(d.vabs) / mx * (cw / 2));
        bar.style.display = "block";
        bar.style.left = (d.vabs >= 0 ? mid : mid - len).toFixed(1) + "px";
        bar.style.width = len.toFixed(1) + "px";
        bar.className = "st-vb-bar" + fav + (d.vabs < 0 ? " st-vb-neg" : "");
    }

    private drawTotal(m: Model): void {
        const show = !!m.total && this.settings.rows.grandTotal !== false && this.H >= 80;
        this.totalEl.style.display = show ? "grid" : "none";
        if (!show || !m.total) return;
        this.totalEl.style.height = this.rowH + "px";
        this.totalEl.setAttribute("role", "row");
        this.totalEl.setAttribute("aria-label", this.t("UI_GrandTotal", "Total"));
        this.fillCells(this.totalEl, m.total, m);
    }

    // ── Minigráfico ──────────────────────────────────────────────────────────

    private paintSpark(el: HTMLElement, d: Row, m: Model): void {
        const svg = el.querySelector("svg.st-svg") as SVGSVGElement;
        const w = this.sparkW + this.labelW, h = this.rowH;
        if (svg.getAttribute("width") !== String(w)) svg.setAttribute("width", String(w));
        if (svg.getAttribute("height") !== String(h)) svg.setAttribute("height", String(h));
        let g = d.spark as Geo | null;
        if (!g || g.gen !== this.gen) { g = this.geo(d, m); d.spark = g; }
        const set = (cls: string, v: string) => {
            const p = svg.querySelector("." + cls) as SVGPathElement;
            if (p.getAttribute("d") !== v) { if (v) p.setAttribute("d", v); else p.removeAttribute("d"); }
        };
        set("st-b1", g.b1); set("st-b2", g.b2); set("st-b3", g.b3);
        set("st-band", g.band); set("st-area", g.area); set("st-pos", g.pos); set("st-neg", g.neg); set("st-tgt", g.tgt);
        set("st-line", g.line); set("st-mk-neg", g.mkNeg); set("st-mk-first", g.mkFirst); set("st-mk-max", g.mkMax);
        set("st-mk-min", g.mkMin); set("st-mk-last", g.mkLast); set("st-hover", "");
        // Line colour: por fila o por tendencia, la línea, las barras y los marcadores toman el color de la fila.
        if (g.color) { svg.style.setProperty("--st-line", g.color); svg.style.setProperty("--st-accent", g.color); }
        else { svg.style.removeProperty("--st-line"); svg.style.removeProperty("--st-accent"); }
        svg.classList.toggle("st-colored", !!g.color);
        const line = svg.querySelector(".st-line") as SVGPathElement;
        line.style.strokeWidth = String(this.settings.sparkline.width);
        const t = svg.querySelector(".st-lastlbl") as SVGTextElement;
        t.textContent = g.lastText;
        t.setAttribute("x", String(w - 2));
        t.setAttribute("y", String(Math.round(h / 2)));
        t.style.fontSize = Math.max(7, Math.min(Number(this.settings.values.fontSize) - 1, Math.round(h * 0.55))) + "px";
    }

    /**
     * Line colour. Neutral: "" (gris de la plantilla con el último punto en el acento). Per row: la paleta del tema,
     * estable por clave de fila (en los subtotales, el color del nivel). By trend: el verde/rojo de la columna Δ según
     * el último valor frente a la base de "Change vs" (sin base, neutro). Alto contraste manda: siempre "".
     */
    private rowLineColor(r: Row): string {
        const mode = String(this.settings.sparkline.lineColor);
        if (this.hc || mode === "neutral") return "";
        if (mode === "row") {
            try { return this.pal?.getColor?.(r.isLeaf ? "row:" + r.key : "level:" + r.level)?.value ?? ""; } catch { return ""; }
        }
        if (r.delta === null) return "";
        const inv = !!this.settings.values.invert;
        const good = r.delta === 0 ? true : (r.delta > 0) !== inv;
        return good ? this.look.up : this.look.down;
    }

    /** Bandas del bullet: bordes en unidades del valor (umbrales en % del objetivo) o null si no tocan. */
    private bandEdges(t: Num, m: Model): { edges: [number, number]; lower: boolean; p1: number; p2: number } | null {
        const b = this.settings.bands;
        if (b.showBands === false || t === null || !(t > 0) || !this.showTarget(m) || this.settings.sparkline.type !== "bullet") return null;
        let p1 = Number(b.band1Pct) / 100, p2 = Number(b.band2Pct) / 100;
        if (p1 > p2) [p1, p2] = [p2, p1];
        const lower = !!b.lowerIsBetter;
        // Lower is better: los mismos umbrales reflejados alrededor del 100 % (80/95 → bueno ≤ 105 %, malo > 120 %).
        const edges: [number, number] = lower ? [t * (2 - p2), t * (2 - p1)] : [t * p1, t * p2];
        return { edges, lower, p1, p2 };
    }

    /** En qué banda cae el valor del bullet (para el tooltip). */
    private bandOf(r: Row, m: Model): string {
        const t = this.bulletTarget(r, m), v = r.shown[0];
        const bd = this.bandEdges(t, m);
        if (!bd || v === null || v === undefined) return "";
        const [e1, e2] = bd.edges;
        const k = !bd.lower ? (v < e1 ? 1 : v < e2 ? 2 : 3) : (v <= e1 ? 3 : v <= e2 ? 2 : 1);
        const name = k === 1 ? this.t("UI_BandPoor", "Poor") : k === 2 ? this.t("UI_BandFair", "Fair") : this.t("UI_BandGood", "Good");
        return name + " (" + this.fmtPctPlain(v / (t as number)) + " " + this.t("UI_OfTarget", "of target") + ")";
    }

    private fmtPctPlain(v: number): string {
        try { return new Intl.NumberFormat(this.host.locale || "en-US", { style: "percent", maximumFractionDigits: 1 }).format(v); } catch { return (v * 100).toFixed(1) + "%"; }
    }

    /** Escala por fila: siempre, o (auto, propuesta pendiente de Tino) solo en las filas de detalle. */
    private perRow(r: Row): boolean {
        const sc = String(this.settings.sparkline.scale);
        return sc === "row" || (sc === "auto" && r.isLeaf);
    }

    private rowExt(r: Row, m: Model): [number, number] {
        const s = this.settings;
        const type = String(s.sparkline.type);
        if (type === "bullet") {
            if (this.perRow(r)) {
                const b: [number, number] = [0, 0];
                const bt = this.bulletTarget(r, m);
                for (const v of [r.shown[0], bt, bt !== null && this.bandEdges(bt, m) ? bt * 1.1 : null]) if (v !== null && v !== undefined) { b[0] = Math.min(b[0], v); b[1] = Math.max(b[1], v); }
                return b;
            }
            return this.extBullet.get(r.level) ?? [0, 1];
        }
        let e: [number, number];
        if (this.perRow(r)) {
            e = [Infinity, -Infinity];
            const scan = (arr: Num[]) => { for (const v of arr) if (v !== null) { if (v < e[0]) e[0] = v; if (v > e[1]) e[1] = v; } };
            scan(r.s[m.valueIdx[0]]);
            if (this.showTarget(m)) scan(r.s[m.targetIdx]);
        } else {
            const x = this.ext.get(r.level);
            e = x ? [x[0], x[1]] : [0, 1];
        }
        if (!isFinite(e[0])) e = [0, 1];
        // Columnas y área arrancan SIEMPRE en cero (o en el mínimo si hay negativos), también con escala por fila: una
        // barra que no sale de cero exagera la diferencia. La línea puede ajustarse al rango (o a cero con Start at zero).
        if (type === "column" || type === "area" || s.sparkline.zero) { e[0] = Math.min(0, e[0]); e[1] = Math.max(0, e[1]); }
        return e;
    }

    /** Geometría del minigráfico de una fila (solo para las filas visibles; se guarda hasta el siguiente render). */
    private geo(r: Row, m: Model): Geo {
        const s = this.settings;
        const type = String(s.sparkline.type);
        const g: Geo = { gen: this.gen, line: "", area: "", pos: "", neg: "", tgt: "", band: "", b1: "", b2: "", b3: "", bandName: "", color: "", mkFirst: "", mkMax: "", mkMin: "", mkNeg: "", mkLast: "", lastX: -1, lastY: -1, lastText: "" };
        const sr = r.s[m.valueIdx[0]];
        const nP = sr.length;
        const w = this.sparkW, H = this.rowH;
        const top = Math.max(2, Math.round(H * 0.16)), bot = H - top;
        const ph = Math.max(4, bot - top);
        const f1 = (v: number) => (Math.round(v * 10) / 10).toString();
        const [lo, hi0] = this.rowExt(r, m);
        const hi = hi0 > lo ? hi0 : lo + (Math.abs(lo) || 1);
        const y = (v: number) => top + (hi - v) / (hi - lo) * ph;
        const fmt0 = m.sources[m.valueIdx[0]].format;
        // Los marcadores crecen o encogen con el alto de fila (24 px = tamaño del panel).
        const ms = Number(s.markers.size) * Math.max(0.7, Math.min(1.6, this.rowH / 24));

        g.color = this.rowLineColor(r);
        if (type === "bullet") {
            const x = (v: number) => 2 + (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (w - 4);
            const bh = Math.max(3, Math.round(ph * 0.55)), by = Math.round((H - bh) / 2);
            const bt = this.bulletTarget(r, m);
            const bd = this.bandEdges(bt, m);
            if (bd) {
                // Bandas cualitativas debajo; la barra del valor y la marca del objetivo encima.
                const rect = (a: number, b: number) => b > a ? "M" + f1(x(a)) + "," + top + "H" + f1(x(b)) + "V" + bot + "H" + f1(x(a)) + "Z" : "";
                const [e1, e2] = bd.edges;
                if (!bd.lower) { g.b1 = rect(lo, e1); g.b2 = rect(e1, e2); g.b3 = rect(e2, hi); }
                else { g.b3 = rect(lo, e1); g.b2 = rect(e1, e2); g.b1 = rect(e2, hi); }
            } else g.band = "M2," + top + "H" + (w - 2) + "V" + bot + "H2Z";
            const v = r.shown[0];
            if (v !== null && v !== undefined) {
                const x0 = x(Math.max(lo, Math.min(0, hi))), x1 = x(v);
                const a = Math.min(x0, x1), b = Math.max(x0, x1, a + 1);
                const rect = "M" + f1(a) + "," + by + "H" + f1(b) + "V" + (by + bh) + "H" + f1(a) + "Z";
                if (v < 0) g.neg = rect; else g.pos = rect;
                g.lastText = this.labelW ? this.fmtCompact(v, r.shownFmt[0]) : "";
            }
            const t = this.bulletTarget(r, m);
            if (t !== null && this.showTarget(m)) {
                const tx = f1(x(t));
                g.tgt = "M" + tx + "," + (top - 1) + "V" + (bot + 1);
            }
            return g;
        }

        const band = type === "column" || type === "winloss";
        const step = band ? (w - 4) / Math.max(1, nP) : (nP > 1 ? (w - 6) / (nP - 1) : 0);
        const x = (p: number) => band ? 2 + (p + 0.5) * step : (nP > 1 ? 3 + p * step : w / 2);
        let first = -1, last = -1, iMax = -1, iMin = -1;
        for (let p = 0; p < nP; p++) {
            const v = sr[p];
            if (v === null) continue;
            if (first < 0) first = p;
            last = p;
            if (iMax < 0 || v > (sr[iMax] as number)) iMax = p;
            if (iMin < 0 || v < (sr[iMin] as number)) iMin = p;
        }
        const tgS = this.showTarget(m) ? r.s[m.targetIdx] : null;

        if (type === "winloss") {
            const mid = Math.round(H / 2), bw = Math.max(1, step * 0.72);
            let pos = "", neg = "";
            for (let p = 0; p < nP; p++) {
                const v = sr[p];
                if (v === null) continue;
                const ref = tgS && tgS[p] !== null ? tgS[p] as number : 0;
                if (v === ref) continue;
                const xa = f1(x(p) - bw / 2), wd = f1(bw);
                if (v > ref) pos += "M" + xa + "," + (top) + "h" + wd + "V" + (mid - 1) + "h-" + wd + "Z";
                else neg += "M" + xa + "," + (mid + 1) + "h" + wd + "V" + bot + "h-" + wd + "Z";
            }
            g.pos = pos; g.neg = neg;
            g.band = "M2," + mid + "H" + (w - 2);
            return g;
        }

        if (type === "column") {
            const y0 = y(0), bw = Math.max(1, step * 0.72);
            let pos = "", neg = "";
            for (let p = 0; p < nP; p++) {
                const v = sr[p];
                if (v === null) continue;
                const xa = f1(x(p) - bw / 2), wd = f1(bw), yv = y(v);
                const a = Math.min(y0, yv), b = Math.max(y0, yv, a + 1);
                const seg = "M" + xa + "," + f1(a) + "h" + wd + "V" + f1(b) + "h-" + wd + "Z";
                if (v < 0) neg += seg; else pos += seg;
            }
            g.pos = pos; g.neg = neg;
        } else {
            // Línea / área con la curva elegida (Linear, Smooth = monótona, Step = escalón centrado). defined() corta en
            // cada periodo vacío: un hueco nunca se une ni se pone a cero.
            const curve = s.sparkline.curve === "smooth" ? curveMonotoneX : s.sparkline.curve === "step" ? curveStep : curveLinear;
            const idx = sr.map((_v, p) => p);
            const ok = (p: number) => sr[p] !== null;
            const ln = d3line<number>().defined(ok).x(p => x(p)).y(p => y(sr[p] as number)).curve(curve);
            let d = ln(idx) || "";
            // Un punto suelto (huecos a los dos lados) se ve como un trazo corto.
            for (let p = 0; p < nP; p++) if (ok(p) && (p === 0 || !ok(p - 1)) && (p === nP - 1 || !ok(p + 1))) d += "M" + f1(x(p)) + "," + f1(y(sr[p] as number)) + "h0.01";
            g.line = d;
            if (type === "area") {
                const baseY = y(lo <= 0 && hi >= 0 ? 0 : lo);
                g.area = d3area<number>().defined(ok).x(p => x(p)).y0(baseY).y1(p => y(sr[p] as number)).curve(curve)(idx) || "";
            }
        }

        if (tgS) {
            let d = "", pen = false;
            for (let p = 0; p < nP; p++) {
                const v = tgS[p];
                if (v === null) { pen = false; continue; }
                const X = band ? x(p) - step / 2 : x(p), Y = f1(y(v));
                d += (pen ? "L" : "M") + f1(X) + "," + Y;
                if (band) d += "L" + f1(X + step) + "," + Y;
                pen = true;
            }
            g.tgt = d;
        }

        // Marcadores: forma propia para cada uno (no solo color: sirve en alto contraste).
        const circ = (p: number, rr: number) => { const X = x(p), Y = y(sr[p] as number); return "M" + f1(X - rr) + "," + f1(Y) + "a" + rr + "," + rr + " 0 1,0 " + (2 * rr) + ",0a" + rr + "," + rr + " 0 1,0 " + (-2 * rr) + ",0"; };
        const tri = (p: number, rr: number, upw: boolean) => { const X = x(p), Y = y(sr[p] as number), k = upw ? -1 : 1; return "M" + f1(X) + "," + f1(Y + k * rr * 1.3) + "L" + f1(X + rr * 1.15) + "," + f1(Y - k * rr * 0.75) + "L" + f1(X - rr * 1.15) + "," + f1(Y - k * rr * 0.75) + "Z"; };
        const sq = (p: number, rr: number) => { const X = x(p), Y = y(sr[p] as number); return "M" + f1(X - rr) + "," + f1(Y - rr) + "h" + f1(2 * rr) + "v" + f1(2 * rr) + "h" + f1(-2 * rr) + "Z"; };
        const mk = s.markers;
        if (last >= 0) {
            if (mk.negative) { let d = ""; for (let p = 0; p < nP; p++) if (sr[p] !== null && (sr[p] as number) < 0) d += circ(p, ms * 0.85); g.mkNeg = d; }
            if (mk.first && first !== last) g.mkFirst = sq(first, ms * 0.8);
            if (mk.max && iMax >= 0 && sr[iMax] !== sr[iMin]) g.mkMax = tri(iMax, ms, true);
            if (mk.min && iMin >= 0 && sr[iMax] !== sr[iMin]) g.mkMin = tri(iMin, ms, false);
            if (mk.last) g.mkLast = circ(last, ms);
            g.lastX = x(last); g.lastY = y(sr[last] as number);
            if (this.labelW) g.lastText = this.fmtCompact(sr[last] as number, r.fmt?.[m.valueIdx[0]]?.[last] ?? fmt0);
        }
        return g;
    }

    // ── Interacción ──────────────────────────────────────────────────────────

    /** Un clic = un toggle: si el host aún no ha contestado al anterior de esa fila, se ignora (se ve atenuado). */
    private onToggle(d: Row, entireLevel: boolean): void {
        if (!this.canInteract || !d.expandable || !d.id) return;
        if (this.pendingToggle.has(d.key)) { this.dbg.ignoredPending++; return; }
        this.focusKey = d.key;
        this.dbg.toggles++;
        this.pendingToggle.set(d.key, Date.now());
        // Si el host no contestara, se libera a los 4 s para no bloquear la fila.
        window.setTimeout(() => { if (this.pendingToggle.delete(d.key)) this.drawRows(); }, 4000);
        // El host guarda el estado (marcadores incluidos) y manda un update nuevo. Sin persistProperties.
        this.selMgr.toggleExpandCollapse(d.id, entireLevel);
        this.drawRows();
    }

    private rowKey(id: ISelectionId): string { return id.getKey(); }

    /**
     * Selección calculada en el visual (filtros-todas-las-filas): select(lista) no alterna como con un id suelto. Un
     * subtotal pasa las identidades de todas sus hojas; se manda la selección entera con select(todas, false) o clear().
     */
    private selectRow(d: Row, multi: boolean): void {
        const ids = selectionIdsOf(d);
        if (!ids.length) return;
        const wasSel = this.isSelected(d);
        if (!multi) {
            const only = wasSel && this.sel.size === ids.length;
            this.sel.clear();
            if (!only) ids.forEach(id => this.sel.set(this.rowKey(id), id));
        } else if (wasSel) {
            ids.forEach(id => this.sel.delete(this.rowKey(id)));
        } else {
            ids.forEach(id => this.sel.set(this.rowKey(id), id));
        }
        this.selGen++;
        const list = Array.from(this.sel.values());
        if (list.length) this.selMgr.select(list, false); else this.selMgr.clear();
        this.drawRows();
        this.announce();
    }

    private clearSelection(): void {
        if (!this.canInteract) return;
        this.sel.clear();
        this.selGen++;
        this.selMgr.clear();
        this.drawRows();
    }

    private isSelected(d: Row): boolean {
        if (!this.sel.size) return false;
        const c = this.selCache.get(d);
        if (c && c.gen === this.selGen) return c.v;
        const ids = selectionIdsOf(d);
        const v = ids.length > 0 && ids.every(id => this.sel.has(this.rowKey(id)));
        this.selCache.set(d, { gen: this.selGen, v });
        return v;
    }

    /**
     * Selección que devuelve el host (marcador, otra página): se casa con las identidades de NUESTRAS filas. Por clave y,
     * como respaldo, con equals/includes (Calendar 1.2: el marcador devuelve claves con otra forma).
     */
    private applyRestore(): void {
        const ids = this.pendingRestore;
        const m = this.model;
        if (!ids || !m) return;
        this.pendingRestore = null;
        this.sel.clear();
        this.selGen++;
        if (!ids.length) return;
        const byKey = new Map<string, ISelectionId>();
        for (const r of m.all) if (r.id) byKey.set(this.rowKey(r.id), r.id);
        const rowIds = m.all.filter(r => !!r.id).map(r => r.id as ISelectionId);
        // El respaldo equals/includes es O(ids × filas): con selecciones enormes (un subtotal de miles de hojas) se
        // limita para no congelar el visual; el filtro del host no depende de esto, solo el resaltado.
        const fallback = this.restoreDeep && ids.length * rowIds.length <= 5e5;
        this.restoreDeep = false;
        for (const id of ids) {
            const k = this.rowKey(id);
            const mine = byKey.get(k) ?? (!fallback ? undefined : rowIds.find(x => { try { return x.equals(id); } catch { return false; } })
                ?? rowIds.find(x => { try { return (x as any).includes?.(id) && (id as any).includes?.(x); } catch { return false; } }));
            if (mine) this.sel.set(this.rowKey(mine), mine);
        }
    }

    /**
     * Tooltip (Tino, 12-11: "muchas veces me activa los tooltips"): solo sobre el minigráfico (o la fila sin el nombre,
     * según el panel), con 300 ms de retardo, nunca con un clic en curso, y fuera de la fila (encima o debajo) para no
     * tapar lo que se está mirando. Se oculta al pulsar, al hacer scroll y al salir de la celda.
     */
    private onHover(e: MouseEvent, d: Row, rowEl: HTMLElement): void {
        const m = this.model;
        if (!m) return;
        const mode = String(this.settings.rows.tooltips);
        const target = e.target as Element;
        const cell = target.closest(".st-c-spark");
        const onValue = !!target.closest(".st-c-val, .st-c-delta, .st-c-pct, .st-c-m2, .st-c-m3, .st-c-pl, .st-c-py, .st-c-fc, .st-c-vabs, .st-c-vbar, .st-c-vpct, .st-c-stat");
        const svg = rowEl.querySelector("svg.st-svg") as SVGSVGElement | null;
        const hover = svg ? svg.querySelector(".st-hover") as SVGPathElement : null;
        this.layerEl.querySelectorAll(".st-hover").forEach(p => { if (p !== hover) p.removeAttribute("d"); });
        const allowed = mode !== "off" && !this.pointerBusy && (cell || (mode === "row" && onValue));
        if (!allowed) { this.hideTip(); return; }
        const rect = this.element.getBoundingClientRect();
        const rr = rowEl.getBoundingClientRect();
        // Fuera de la fila: debajo si la fila está en la mitad de arriba; encima si está en la de abajo.
        const below = rr.top - rect.top < this.H / 2;
        const coords = [e.clientX - rect.left, below ? rr.bottom - rect.top + 2 : rr.top - rect.top - 2];
        let items: VisualTooltipDataItem[];
        if (cell && svg && this.settings.sparkline.type !== "bullet") {
            const sr = svg.getBoundingClientRect();
            const px = e.clientX - sr.left;
            const nP = m.periods.length;
            const band = this.settings.sparkline.type === "column" || this.settings.sparkline.type === "winloss";
            const p = Math.max(0, Math.min(nP - 1, band ? Math.floor((px - 2) / ((this.sparkW - 4) / nP)) : Math.round((px - 3) / (nP > 1 ? (this.sparkW - 6) / (nP - 1) : 1))));
            items = this.pointTip(d, p, m);
            if (hover) {
                const X = band ? 2 + (p + 0.5) * (this.sparkW - 4) / nP : (nP > 1 ? 3 + p * (this.sparkW - 6) / (nP - 1) : this.sparkW / 2);
                hover.setAttribute("d", "M" + X.toFixed(1) + ",1V" + (this.rowH - 1));
            }
        } else {
            if (hover) hover.removeAttribute("d");
            items = this.rowTip(d, m);
        }
        const show = () => {
            this.tipTimer = null;
            if (this.pointerBusy) return;
            this.host.tooltipService.show({ dataItems: items, identities: d.id ? [d.id] : [], coordinates: coords, isTouchEvent: false });
            this.tipShown = true;
        };
        if (this.tipShown) { this.host.tooltipService.move({ dataItems: items, identities: d.id ? [d.id] : [], coordinates: coords, isTouchEvent: false }); return; }
        if (this.tipTimer !== null) window.clearTimeout(this.tipTimer);
        this.tipTimer = window.setTimeout(show, 300);
    }

    private hideTip(): void {
        if (this.tipTimer !== null) { window.clearTimeout(this.tipTimer); this.tipTimer = null; }
        if (this.tipShown) { try { this.host.tooltipService.hide({ immediately: true, isTouchEvent: false }); } catch { /* sin servicio */ } }
        this.tipShown = false;
        this.layerEl.querySelectorAll(".st-hover").forEach(p => p.removeAttribute("d"));
    }

    private pathLabel(d: Row): string {
        if (d.level < 0) return this.t("UI_GrandTotal", "Total");
        const parts: string[] = [];
        for (let r: Row | null = d; r; r = r.parent) parts.unshift(r.label);
        return parts.join(" › ");
    }

    private pointTip(d: Row, p: number, m: Model): VisualTooltipDataItem[] {
        const out: VisualTooltipDataItem[] = [{ displayName: this.pathLabel(d), value: this.periodLabels[p] ?? "" }];
        const val = (i: number) => this.fmtFull(d.s[i][p], d.fmt?.[i]?.[p] ?? m.sources[i].format);
        m.valueIdx.forEach(i => out.push({ displayName: m.sources[i].displayName, value: val(i) || this.t("UI_Blank", "(Blank)") }));
        const m0 = m.valueIdx[0];
        const prev = p > 0 ? d.s[m0][p - 1] : null, v = d.s[m0][p];
        if (v !== null && prev !== null) {
            const dl = v - prev;
            out.push({ displayName: this.tf("UI_DeltaVs", "Δ vs {0}", this.periodLabels[p - 1]),
                value: this.signed(dl, this.fmtCompact(dl, m.sources[m0].format)) + (prev > 0 ? "  (" + this.fmtPct(dl / prev) + ")" : "") });
        }
        for (const i of [m.targetIdx, m.planIdx, m.pyIdx, m.fcIdx].concat(m.tipIdx)) if (i >= 0) out.push({ displayName: m.sources[i].displayName, value: val(i) || this.t("UI_Blank", "(Blank)") });
        return out;
    }

    private rowTip(d: Row, m: Model): VisualTooltipDataItem[] {
        const lastLbl = this.periodLabels[m.lastIdx] ?? "";
        const ctx = this.valueModeUsed === "total" ? this.t("UI_Total", "Total") : lastLbl;
        const out: VisualTooltipDataItem[] = [{ displayName: this.pathLabel(d), value: ctx }];
        m.valueIdx.forEach((i, k) => out.push({ displayName: m.sources[i].displayName, value: this.fmtFull(d.shown[k] ?? null, d.shownFmt[k]) || this.t("UI_Blank", "(Blank)") }));
        if (this.baseIdx >= 0) {
            const m0 = m.valueIdx[0];
            const vs = this.tf("UI_Vs", "vs {0}", this.periodLabels[this.baseIdx]);
            out.push({ displayName: lastLbl + " " + vs, value: d.delta === null ? this.t("UI_Blank", "(Blank)")
                : this.signed(d.delta, this.fmtCompact(d.delta, m.sources[m0].format)) + (d.deltaPct !== null ? "  (" + this.fmtPct(d.deltaPct) + ")" : "") });
            if (d.delta !== null && d.deltaPct === null) out.push({ displayName: "Δ%", value: this.t("UI_NoPctBase", "not shown: the base is zero or negative") });
            const band = this.bandOf(d, m);
            if (band) out.push({ displayName: this.t("UI_Band", "Band"), value: band });
            if (d.small) out.push({ displayName: "Δ%", value: this.tf("UI_SmallBase", "small base ({0}): read the % with care", this.fmtFull(d.base, m.sources[m0].format)) });
        }
        const vbi = this.varBaseIdx(m);
        if (vbi >= 0 && this.previewOf("variance") && this.settings.variance.show !== false) {
            const m0 = m.valueIdx[0];
            out.push({ displayName: "Δ" + this.varCode(m) + " · " + this.tf("UI_Vs", "vs {0}", m.sources[vbi].displayName),
                value: d.vabs === null ? this.t("UI_Blank", "(Blank)") : this.signed(d.vabs, this.fmtCompact(d.vabs, m.sources[m0].format)) + (d.vpct !== null ? "  (" + this.fmtPct(d.vpct) + ")" : "") });
            if (d.vabs !== null && d.vpct === null) out.push({ displayName: "Δ" + this.varCode(m) + "%", value: this.t("UI_NoPctBase", "not shown: the base is zero or negative") });
        }
        const tIdx = [m.targetIdx, m.planIdx, m.pyIdx, m.fcIdx].concat(m.tipIdx);
        for (const i of tIdx) if (i >= 0) {
            const v = this.valueModeUsed === "total" ? d.tot[i] : (m.lastIdx >= 0 ? d.s[i][m.lastIdx] : null);
            out.push({ displayName: m.sources[i].displayName, value: this.fmtFull(v, m.sources[i].format) || this.t("UI_Blank", "(Blank)") });
        }
        if (d.expandable && this.canInteract) out.push({ displayName: d.collapsed ? "▸" : "▾", value: this.t("UI_ToggleHint", "click the arrow to expand or collapse; Alt + click for the whole level") });
        return out;
    }

    // ── Teclado ──────────────────────────────────────────────────────────────

    private onKey(e: KeyboardEvent): void {
        if (!this.rows.length) return;
        const n = this.rows.length;
        const page = Math.max(1, Math.floor((this.scroller.clientHeight || this.H) / this.rowH) - 1);
        let i = this.focusIdx < 0 ? 0 : this.focusIdx;
        const r = this.rows[i];
        let handled = true;
        switch (e.key) {
            case "ArrowDown": i = Math.min(n - 1, i + 1); break;
            case "ArrowUp": i = Math.max(0, i - 1); break;
            case "PageDown": i = Math.min(n - 1, i + page); break;
            case "PageUp": i = Math.max(0, i - page); break;
            case "Home": i = 0; break;
            case "End": i = n - 1; break;
            case "ArrowRight":
                if (r.expandable && r.collapsed) this.onToggle(r, false);
                else if (r.children.length) i = r.index + 1;
                break;
            case "ArrowLeft":
                if (r.expandable && !r.collapsed) this.onToggle(r, false);
                else if (r.parent) i = r.parent.index;
                break;
            case "Enter": case " ":
                if (this.canInteract) this.selectRow(r, e.ctrlKey || e.metaKey);
                break;
            case "Escape": this.clearSelection(); break;
            default: handled = false;
        }
        if (!handled) return;
        e.preventDefault();
        e.stopPropagation();
        if (i !== this.focusIdx) {
            this.focusIdx = i;
            this.focusKey = this.rows[i].key;
            const y = i * this.rowH, vh = this.scroller.clientHeight || this.H;
            if (y < this.scroller.scrollTop) this.scroller.scrollTop = y;
            else if (y + this.rowH > this.scroller.scrollTop + vh) this.scroller.scrollTop = y + this.rowH - vh;
            this.drawRows();
            this.announce();
        }
    }

    private announce(): void {
        const m = this.model;
        const r = this.rows[this.focusIdx];
        if (!m || !r) return;
        this.root.setAttribute("aria-activedescendant", "st-r-" + r.index);
        const parts = [r.label, this.tf("UI_Level", "level {0}", String(r.level + 1)), this.fmtFull(r.shown[0] ?? null, r.shownFmt[0])];
        if (r.deltaPct !== null) parts.push(this.fmtPct(r.deltaPct));
        if (r.expandable) parts.push(r.collapsed ? this.t("UI_Collapsed", "collapsed") : this.t("UI_Expanded", "expanded"));
        if (this.isSelected(r)) parts.push(this.t("UI_Selected", "selected"));
        this.live.textContent = parts.filter(x => x).join(", ");
    }

    // ── Pantalla de inicio y asistente ───────────────────────────────────────

    private message(text: string): void {
        const el = this.div("st-landing st-msg", this.root);
        el.textContent = text;
    }

    private landingIcon(size: number): SVGSVGElement {
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg") as SVGSVGElement;
        svg.setAttribute("width", String(size)); svg.setAttribute("height", String(size)); svg.setAttribute("viewBox", "0 0 44 44");
        svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "st-l-icon");
        const hc = this.hc;
        const rect = document.createElementNS(NS, "rect");
        rect.setAttribute("width", "44"); rect.setAttribute("height", "44"); rect.setAttribute("rx", "9");
        rect.setAttribute("fill", hc ? this.hcBg : "#1F4E8C");
        if (hc) { rect.setAttribute("stroke", this.hcFg); rect.setAttribute("stroke-width", "1.5"); }
        svg.appendChild(rect);
        [["8,13 14,11 20,12 26,8 34,9", 11], ["8,24 14,22 20,25 26,20 34,18", 22], ["8,35 14,33 20,31 26,32 34,28", 33]].forEach(([pts], i) => {
            const p = document.createElementNS(NS, "polyline");
            p.setAttribute("points", String(pts)); p.setAttribute("fill", "none");
            p.setAttribute("stroke", hc ? this.hcFg : (i === 1 ? "#3FBF7F" : "#BFD7F2")); p.setAttribute("stroke-width", "2.2");
            p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
            svg.appendChild(p);
        });
        return svg;
    }

    private renderLanding(): void {
        const W = this.W, H = this.H;
        const size = (W >= 600 && H >= 340) ? "l" : (W >= 360 && H >= 220) ? "m" : "s";
        const hc = this.hc;
        const fg = hc ? this.hcFg : "";
        const el = this.div("st-landing st-landing-" + size, this.root);
        if (hc) el.style.background = this.hcBg;
        const mk = (tag: string, cls?: string, text?: string): HTMLElement => {
            const n = document.createElement(tag);
            if (cls) n.className = cls;
            if (text !== undefined) n.textContent = text;
            if (fg) n.style.color = fg;
            return n;
        };
        const rowsW = this.t("Role_Rows", "Rows"), perW = this.t("Role_Period", "Period"), valW = this.t("Role_Values", "Values");
        const head = mk("div", "st-l-head");
        head.appendChild(this.landingIcon(size === "l" ? 44 : size === "m" ? 34 : 26));
        const titles = mk("div");
        titles.appendChild(mk("div", "st-l-title", "Sparkline Table by TCViz"));
        if (size !== "s") titles.appendChild(mk("div", "st-l-tag", size === "l"
            ? this.t("Landing_Tagline", "Which rows are drifting, and is it a trend or one bad month? Your hierarchy, one sparkline per row.")
            : this.t("Landing_TaglineShort", "Your hierarchy, one sparkline per row.")));
        head.appendChild(titles);
        el.appendChild(head);
        const link = (txt: string, url: string, cls: string): HTMLElement => {
            const a = mk("a", cls) as HTMLAnchorElement;
            a.href = url; a.tabIndex = 0; a.textContent = txt;
            if (hc) { a.style.background = "transparent"; a.style.borderColor = fg; }
            const open = (e: Event) => { e.preventDefault(); e.stopPropagation(); if (this.canInteract) this.host.launchUrl(url); };
            a.addEventListener("click", open);
            a.addEventListener("keydown", (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") open(e); });
            return a;
        };
        const links: [string, string, string][] = [
            [this.t("Landing_Guide", "Guide"), this.t("Landing_GuideSub", "support page"), URL_GUIDE],
            [this.t("Landing_Product", "Product page"), "tcviz.com", URL_PRODUCT],
        ];
        if (size === "s") {
            el.appendChild(mk("p", "st-l-do", this.tf("Landing_Small", "Add {0}, {1} and {2}.", rowsW, perW, valW)));
            const row = mk("div", "st-l-inline");
            row.appendChild(link(links[0][0], links[0][2], "st-l-a"));
            el.appendChild(row);
            return;
        }
        const big = size === "l";
        const has = (role: string) => !!this.dataView?.metadata?.columns?.some(c => c.roles?.[role]);
        const steps = mk("ol", "st-l-steps");
        const step = (n: number, well: string, txt: string, done: boolean) => {
            const li = mk("li");
            const num = mk("b", "st-l-n", done ? "✓" : String(n));
            if (hc) { num.style.background = fg; num.style.color = this.hcBg; }
            li.appendChild(num);
            const sp = mk("span");
            sp.appendChild(mk("strong", "st-l-well", well));
            sp.appendChild(document.createTextNode(" · " + txt));
            li.appendChild(sp);
            steps.appendChild(li);
        };
        step(1, rowsW, big ? this.t("Landing_Drag1", "drag one to three fields, outermost first (region › rep › customer)") : this.t("Landing_Drag1Short", "a hierarchy"), has("rows"));
        step(2, perW, big ? this.t("Landing_Drag2", "drag a month or date field: it becomes the sparkline axis") : this.t("Landing_Drag2Short", "a month or date"), has("period"));
        step(3, valW, big ? this.t("Landing_Drag3", "drag one to three measures; add Target for a target line") : this.t("Landing_Drag3Short", "one to three measures"), has("values"));
        if (big) {
            const cols = mk("div", "st-l-cols");
            const c1 = mk("div");
            c1.appendChild(mk("div", "st-l-lbl", this.t("Landing_Start", "Start in 3 steps")));
            c1.appendChild(steps);
            const c2 = mk("div");
            c2.appendChild(mk("div", "st-l-lbl", this.t("Landing_Help", "Help")));
            const list = mk("div", "st-l-links");
            for (const [txt, sub, url] of links) {
                const a = link(txt, url, "st-l-card");
                a.appendChild(mk("small", "st-l-sub", sub));
                list.appendChild(a);
            }
            c2.appendChild(list);
            cols.appendChild(c1); cols.appendChild(c2);
            el.appendChild(cols);
        } else {
            el.appendChild(steps);
            const row = mk("div", "st-l-inline");
            for (const l of links) row.appendChild(link(l[1] === "tcviz.com" ? "tcviz.com" : l[0], l[2], "st-l-a"));
            el.appendChild(row);
        }
    }

    /**
     * Asistente de 3 pasos, solo editando y con sitio: (1) los campos, (2) cómo leer la tabla (valor, comparación, tipo
     * de minigráfico), (3) el estilo. Cada botón cambia UN ajuste, solo desde el clic (persistProperties). ✕ o Finish
     * lo cierran (style.guide = false); se reabre en Formato → Style template.
     */
    private renderGuide(): void {
        if (!this.guideEl) {
            this.guideEl = this.div("st-guide", this.root);
        }
        const el = this.guideEl;
        this.root.appendChild(el);
        while (el.firstChild) el.removeChild(el.firstChild);
        el.style.display = "none";
        const W = this.W, H = this.H;
        const on = this.settings.style?.guide !== false;
        const m = this.model;
        if (!this.editing || this.formatMode || !on || !this.canInteract || !m || !m.valueIdx.length || W < 420 || H < 260) return;
        const hc = this.hc;
        const azul = hc ? this.hcSel : "#2B6CB0";
        const fg = hc ? this.hcFg : "#252423";
        const muted = hc ? fg : "#605E5C";
        el.style.display = "block";
        el.style.background = hc ? this.hcBg : "#FFFFFF";
        el.style.borderColor = azul;
        el.style.color = fg;
        el.setAttribute("role", "dialog");
        el.setAttribute("aria-label", this.t("Guide_Title", "Setup guide"));
        el.onclick = e => e.stopPropagation();
        el.onkeydown = e => e.stopPropagation();
        el.onmousemove = e => e.stopPropagation();
        const mk = (tag: string, cls: string, text?: string): HTMLElement => {
            const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n;
        };
        const boton = (texto: string, principal: boolean, accion: () => void): HTMLButtonElement => {
            const b = mk("button", "st-g-btn", texto) as HTMLButtonElement;
            b.type = "button";
            b.style.borderColor = azul;
            b.style.background = principal ? azul : "transparent";
            b.style.color = principal ? (hc ? this.hcBg : "#FFFFFF") : azul;
            b.addEventListener("click", accion);
            return b;
        };
        const terminar = () => { this.guideStep = 1; this.persistir("style", { guide: false }); };
        const cab = mk("div", "st-g-head");
        const paso = mk("div", "", this.tf("Guide_Step", "Setup · step {0} of 3", String(this.guideStep)));
        paso.style.color = azul;
        const cerrar = mk("button", "st-g-close", "✕") as HTMLButtonElement;
        cerrar.type = "button";
        cerrar.title = this.t("Guide_Close", "Close the guide");
        cerrar.setAttribute("aria-label", cerrar.title);
        cerrar.style.color = muted;
        cerrar.addEventListener("click", terminar);
        cab.appendChild(paso); cab.appendChild(cerrar);
        el.appendChild(cab);
        const titulo = mk("div", "st-g-title");
        el.appendChild(titulo);
        const pie = mk("div", "st-g-foot");
        const has = (role: string) => !!this.dataView?.metadata?.columns?.some(c => c.roles?.[role]);
        const chips = (label: string, obj: string, prop: string, items: [any, string, string][], cur: string) => {
            el.appendChild(mk("div", "st-g-lbl", label));
            const row = mk("div", "st-g-chips");
            for (const [v, k, l] of items) {
                const b = mk("button", "st-g-chip", this.t(k, l)) as HTMLButtonElement;
                b.type = "button";
                b.setAttribute("aria-pressed", String(String(v) === cur));
                b.style.borderColor = String(v) === cur ? azul : (hc ? fg : "#C8C6C4");
                b.style.borderWidth = String(v) === cur ? "2px" : "1px";
                b.style.color = fg;
                b.style.background = hc ? this.hcBg : "#FFFFFF";
                b.addEventListener("click", () => this.persistir(obj, { [prop]: v }));
                row.appendChild(b);
            }
            el.appendChild(row);
        };
        if (this.guideStep === 1) {
            titulo.textContent = this.t("Guide_Fields", "Your data");
            const fila = (hecho: boolean, nombre: string, porque: string) => {
                const f = mk("div", "st-g-item");
                const marca = mk("span", "", hecho ? "✓" : "○");
                marca.setAttribute("aria-label", hecho ? this.t("Guide_Done", "added") : this.t("Guide_Todo", "not added"));
                marca.style.color = hecho ? (hc ? fg : "#107C10") : muted;
                const txt = mk("span", "");
                txt.appendChild(mk("b", "", nombre));
                txt.appendChild(document.createTextNode(" — " + porque));
                txt.style.color = hecho ? muted : fg;
                f.appendChild(marca); f.appendChild(txt);
                el.appendChild(f);
            };
            fila(has("rows"), this.t("Role_Rows", "Rows"), this.tf("Guide_RowsWhy", "{0} of 3 levels; ▸ expands a row, Alt + click the whole level", String(m.levels.length)));
            fila(has("period"), this.t("Role_Period", "Period"), this.tf("Guide_PeriodWhy", "{0} periods on the sparkline axis", String(m.periods.length)));
            fila(has("values"), this.t("Role_Values", "Values"), this.t("Guide_ValuesWhy", "the first measure draws the sparkline; up to two more as columns"));
            fila(has("target"), this.t("Role_Target", "Target"), this.t("Guide_TargetWhy", "a target line on every sparkline (and the bullet marker)"));
            fila(has("tooltips"), this.t("Role_Tooltips", "Tooltips"), this.t("Guide_TooltipsWhy", "extra measures in the tooltip"));
            const nota = mk("div", "st-g-note", this.t("Guide_Wells", "Drag the fields into the field wells; this list updates by itself."));
            nota.style.color = muted;
            el.appendChild(nota);
            pie.appendChild(boton(this.t("Guide_Next", "Next"), true, () => { this.guideStep = 2; this.renderGuide(); }));
        } else if (this.guideStep === 2) {
            titulo.textContent = this.t("Guide_Read", "Read it your way");
            const it = (obj: string, prop: string) => OBJECTS[obj].props.find(p => p.name === prop)?.items ?? [];
            const s = this.settings;
            chips(this.t("UI_ValueShows", "Value shows"), "subTotals", "columnSubtotals", [[false, "UI_LastPeriod", "Last period"], [true, "UI_RangeTotal", "Total of the range"]], String(!!s.subTotals.columnSubtotals));
            chips(this.t("Prop_values_compare", "Change vs"), "values", "compare", it("values", "compare"), String(s.values.compare));
            chips(this.t("Prop_sparkline_type", "Type"), "sparkline", "type", it("sparkline", "type"), String(s.sparkline.type));
            chips(this.t("Prop_sparkline_scale", "Scale"), "sparkline", "scale", it("sparkline", "scale"), String(s.sparkline.scale));
            pie.appendChild(boton(this.t("Guide_Back", "Back"), false, () => { this.guideStep = 1; this.renderGuide(); }));
            pie.appendChild(boton(this.t("Guide_Next", "Next"), true, () => { this.guideStep = 3; this.renderGuide(); }));
        } else {
            titulo.textContent = this.t("Guide_Style", "Pick a style");
            const it = OBJECTS.style.props.find(p => p.name === "template")?.items ?? [];
            chips(this.t("Prop_style_template", "Template"), "style", "template", it, String(this.settings.style.template));
            chips(this.t("Prop_rows_density", "Density"), "rows", "density", OBJECTS.rows.props.find(p => p.name === "density")?.items ?? [], String(this.settings.rows.density));
            const nota = mk("div", "st-g-note", this.t("Guide_ThemeNote", "Report theme follows the colors of your report theme, like a native visual."));
            nota.style.color = muted;
            el.appendChild(nota);
            pie.appendChild(boton(this.t("Guide_Back", "Back"), false, () => { this.guideStep = 2; this.renderGuide(); }));
            pie.appendChild(boton(this.t("Guide_Finish", "Finish"), true, terminar));
        }
        el.appendChild(pie);
    }

    private persistir(objectName: string, properties: any): void {
        this.host.persistProperties({ merge: [{ objectName, selector: null as any, properties }] });
    }

    // ── Panel de formato (desde la tabla de tools/formato.py) ───────────────

    private slice(obj: string, p: PropSpec): powerbi.visuals.FormattingSlice {
        const value = this.settings?.[obj]?.[p.name] ?? p.def;
        const descriptor = { objectName: obj, propertyName: p.name };
        const base = { uid: obj + "-" + p.name, displayName: this.t(p.key, p.label) };
        if (p.type === "bool") return { ...base, control: { type: "ToggleSwitch" as any, properties: { descriptor, value: !!value } } } as any;
        if (p.type === "num") return { ...base, control: { type: "NumUpDown" as any, properties: { descriptor, value: Number(value),
            options: { minValue: p.min !== undefined ? { type: 0, value: p.min } : undefined, maxValue: p.max !== undefined ? { type: 1, value: p.max } : undefined } } } } as any;
        if (p.type === "fill") return { ...base, control: { type: "ColorPicker" as any, properties: { descriptor, value: { value: String(value || this.fillDefault(obj, p.name)) } } } } as any;
        if (p.type === "font") return { ...base, control: { type: "FontPicker" as any, properties: { descriptor, value: String(value || FONT) } } } as any;
        if (p.type === "enum") {
            const items = (p.items ?? []).map(([v, k, l]) => ({ value: v, displayName: this.t(k, l) }));
            const cur = items.find(it => it.value === value) ?? items[0];
            return { ...base, control: { type: "Dropdown" as any, properties: { descriptor, value: cur, items } } } as any;
        }
        return { ...base, control: { type: "TextInput" as any, properties: { descriptor, value: String(value), placeholder: "" } } } as any;
    }

    /** El color que se dibuja cuando el usuario no ha elegido ninguno (el panel enseña el real, no un vacío). */
    private fillDefault(obj: string, prop: string): string {
        const L = this.look;
        const k = obj + "." + prop;
        return k === "sparkline.color" ? L.line : k === "sparkline.accent" ? L.accent : k === "sparkline.targetColor" ? L.target
            : k === "values.upColor" || k === "variance.goodColor" ? L.up : k === "values.downColor" || k === "variance.badColor" ? L.down
            : k === "header.background" ? L.bg : prop === "background" ? (obj === "level3" ? L.bg : L.sub) : prop === "color" ? L.text : "#000000";
    }

    /** Tarjeta Row levels: un elemento por nivel presente (y el total), con el mismo juego de opciones. */
    private levelsGroup(revert: powerbi.visuals.FormattingDescriptor[]): any | null {
        const m = this.model;
        if (!m || !m.levels.length) return null;
        const entries: [string, string][] = m.levels.slice(0, 3).map((l, i) =>
            ["level" + (i + 1), this.tf("UI_LevelN", "Level {0}", String(i + 1)) + " · " + l.sources.map(s => s.displayName).join(" + ")]);
        if (m.total) entries.push(["levelTotal", this.cardLabel("levelTotal")]);
        const containerItems = entries.map(([o, name]) => ({
            displayName: name,
            slices: OBJECTS[o].props.map(p => { revert.push({ objectName: o, propertyName: p.name }); return this.slice(o, p); }),
        }));
        return { uid: "levels-group", displayName: undefined, container: { displayName: this.t("UI_LevelPick", "Level"), containerItems } };
    }

    /** Estilo resuelto de cada nivel (-1 = total). Vacío = lo de siempre; alto contraste ignora fondos y colores. */
    private computeLevelStyles(): void {
        this.levelStyles.clear();
        for (const lv of [-1, 0, 1, 2]) {
            const s = this.settings[lv < 0 ? "levelTotal" : "level" + (lv + 1)];
            const op = Math.max(0, Math.min(100, Number(s.bgOpacity))) / 100;
            this.levelStyles.set(lv, {
                bg: !this.hc && s.background ? withAlpha(String(s.background), op) : "",
                color: !this.hc && s.color ? String(s.color) : "",
                fs: Number(s.fontSize) > 0 ? Number(s.fontSize) : 0,
                ff: String(s.fontFamily || ""),
                bold: String(s.bold),
                italic: !!s.italic,
            });
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        const cards: powerbi.visuals.FormattingCard[] = [];
        const m = this.model;
        for (const c of PANE) {
            const revert: powerbi.visuals.FormattingDescriptor[] = [];
            const groups: powerbi.visuals.FormattingGroup[] = [];
            let cardToggle: any;
            for (const g of c.groups) {
                const spec = OBJECTS[g.obj];
                const slices = spec.props.filter(p => p.name !== g.toggle)
                    // Sin Target no hay línea de objetivo que configurar; sin 2.ª/3.ª medida, no se ordena por ellas.
                    .filter(p => !(g.obj === "sparkline" && (p.name === "target" || p.name === "targetColor") && m && m.targetIdx < 0))
                    .map(p => {
                        const sl: any = this.slice(g.obj, p);
                        if (g.obj === "rows" && p.name === "rowHeight" && this.rowHClamped) {
                            sl.displayName += " — " + this.tf("UI_RowHeightRaised", "raised to {0} px to fit the text", String(this.rowH));
                        }
                        if (g.obj === "rows" && p.name === "sortBy" && m) {
                            // Cada "Value" con el nombre de su medida; las que no están, fuera.
                            const names: Record<string, string> = {};
                            m.valueIdx.forEach((vi, k) => { names[k === 0 ? "value" : "value" + (k + 1)] = m.sources[vi].displayName; });
                            const varOk = this.varBaseIdx(m) >= 0;
                            const items = (sl.control.properties.items as any[])
                                .filter(x => !/^value\d?$/.test(x.value) || names[x.value] !== undefined)
                                .filter(x => varOk || (x.value !== "varAbs" && x.value !== "varPct"))
                                .map(x => names[x.value] !== undefined ? { value: x.value, displayName: names[x.value] } : x);
                            sl.control.properties.items = items;
                            const cur = String(this.settings.rows.sortBy);
                            sl.control.properties.value = items.find((x: any) => x.value === cur) ?? items[0];
                        }
                        return sl;
                    });
                spec.props.forEach(p => revert.push({ objectName: g.obj, propertyName: p.name }));
                const grp: any = { uid: c.uid + "-" + g.obj + "-group", displayName: g.key ? this.t(g.key, g.label) : undefined, slices };
                if (g.toggle) {
                    const tp = spec.props.find(p => p.name === g.toggle);
                    const ts: any = this.slice(g.obj, tp);
                    ts.suppressDisplayName = true;
                    if (c.groups.length === 1) cardToggle = ts; else grp.topLevelToggle = ts;
                }
                groups.push(grp);
            }
            if (c.uid === "values" && groups.length) {
                // "Value shows the total of the range" = subtotales de columna del host (subTotals.columnSubtotals).
                const d = { objectName: "subTotals", propertyName: "columnSubtotals" };
                (groups[0] as any).slices.unshift({ uid: "subTotals-columnSubtotals", displayName: this.propLabel("subTotals", "columnSubtotals"),
                    control: { type: "ToggleSwitch", properties: { descriptor: d, value: !!this.settings.subTotals?.columnSubtotals } } });
                revert.push(d);
            }
            if (c.uid === "levels") { const lv = this.levelsGroup(revert); if (!lv) continue; groups.push(lv); }
            const card: any = { uid: c.uid + "-card", displayName: this.t(c.key, c.label), groups, revertToDefaultDescriptors: revert };
            if (cardToggle) card.topLevelToggle = cardToggle;
            cards.push(card);
        }
        return { cards };
    }

    // ── Formato desde el lienzo (on-object) ──────────────────────────────────

    private cardLabel(obj: string): string {
        const spec = OBJECTS[obj];
        return spec ? this.t(spec.key, spec.label) : obj;
    }

    private propLabel(obj: string, prop: string): string {
        if (obj === "subTotals") return this.t("Prop_subTotals_columnSubtotals", "Value shows the total of the range");
        const p = OBJECTS[obj]?.props.find(x => x.name === prop);
        return p ? this.t(p.key, p.label) : prop;
    }

    private markSubSelectables(): void {
        const marcar = (sel: string, objeto: string, tipo: number) => {
            this.root.querySelectorAll(sel).forEach(el => {
                if (!this.formatMode) { el.classList.remove(HtmlSubSelectableClass); return; }
                el.classList.add(HtmlSubSelectableClass);
                el.setAttribute(SubSelectableObjectNameAttribute, objeto);
                el.setAttribute(SubSelectableDisplayNameAttribute, this.cardLabel(objeto));
                el.setAttribute(SubSelectableTypeAttribute, String(tipo));
            });
        };
        marcar(".st-h", "header", 1);
        marcar(".st-row .st-c-spark", "sparkline", 3);
        marcar(".st-row .st-c-val, .st-row .st-c-delta, .st-row .st-c-pct", "values", 1);
        marcar(".st-row .st-c-name", "rows", 1);
        marcar(".st-row .st-c-vabs, .st-row .st-c-vbar, .st-row .st-c-vpct, .st-row .st-ref", "variance", 1);
    }

    private getSubSelectionStyles(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.SubSelectionStyles | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        const ref = (o: string, p: string) => ({ reference: { objectName: o, propertyName: p }, label: this.propLabel(o, p) });
        switch (name) {
            case "sparkline": return { type: 3, stroke: ref("sparkline", "color"), width: ref("sparkline", "width") } as any;
            case "header": return { type: 1, fontSize: ref("header", "fontSize") } as any;
            case "values": return { type: 1, fontSize: ref("values", "fontSize") } as any;
            case "rows": return { type: 1, fontSize: ref("rows", "fontSize") } as any;
        }
        return undefined;
    }

    private getSubSelectionShortcuts(subs: powerbi.visuals.CustomVisualSubSelection[]): powerbi.visuals.VisualSubSelectionShortcuts | undefined {
        const name = subs[0]?.customVisualObjects[0]?.objectName;
        if (!name || !OBJECTS[name]) return undefined;
        const id = (o: string, p: string) => ({ objectName: o, propertyName: p });
        const toggle = (o: string, p: string) => ({ type: 2, ...id(o, p), relatedToggledFormattingIds: [id(o, p)],
            disabledLabel: this.propLabel(o, p), enabledLabel: this.propLabel(o, p) });
        const pick = (o: string, p: string) => ({ type: 3, ...id(o, p), label: this.propLabel(o, p) });
        const reset = (o: string) => ({ type: 0, relatedResetFormattingIds: OBJECTS[o].props.map(p => id(o, p.name)) });
        const nav = (o: string) => ({ type: 1, destinationInfo: { cardUid: "Visual-" + o + "-card" }, label: this.cardLabel(o) });
        const div = { type: 7 };
        switch (name) {
            case "sparkline": return [pick("sparkline", "type"), pick("sparkline", "scale"), toggle("sparkline", "showLast"), toggle("sparkline", "target"), div, reset("sparkline"), nav("sparkline")] as any;
            case "header": return [toggle("header", "show"), toggle("header", "context"), div, reset("header"), nav("header")] as any;
            case "values": return [toggle("subTotals", "columnSubtotals"), pick("values", "compare"), toggle("values", "showDelta"), toggle("values", "showDeltaPct"), div, reset("values"), nav("values")] as any;
            case "rows": return [pick("rows", "density"), toggle("rows", "grandTotal"), pick("rows", "sortBy"), div, reset("rows"), nav("rows")] as any;
            case "variance": return [pick("variance", "base"), toggle("variance", "showReference"), toggle("variance", "showAbs"), toggle("variance", "showPct"),
                toggle("variance", "showBar"), div, reset("variance"), nav("variance")] as any;
        }
        return undefined;
    }

    // ── Utilidades ───────────────────────────────────────────────────────────

    private div(cls: string, parent: HTMLElement): HTMLDivElement {
        const e = document.createElement("div");
        e.className = cls;
        parent.appendChild(e);
        return e;
    }

    public destroy(): void {
        this.hideTip();
        if (this.scrollRaf) cancelAnimationFrame(this.scrollRaf);
        this.root.remove();
    }
}

/** Mezcla a sobre b (a·k + b·(1−k)), para fondos de selección y hover que funcionan en temas claros y oscuros. */
function mix(a: string, b: string, k: number): string {
    const pa = hex(a), pb = hex(b);
    if (!pa || !pb) return a;
    const c = pa.map((x, i) => Math.round(x * k + pb[i] * (1 - k)));
    return "#" + c.map(x => x.toString(16).padStart(2, "0")).join("");
}

/** Texto para buscar: minúsculas y sin acentos. */
function norm(s: string): string {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/** Color con opacidad (rgba) para el fondo de cada nivel. */
function withAlpha(c: string, a: number): string {
    const p = hex(c);
    if (!p) return c;
    return a >= 1 ? c : "rgba(" + p.join(",") + "," + a.toFixed(2) + ")";
}

function hex(c: string): number[] | null {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(c).trim());
    if (!m) {
        const s = /^#?([0-9a-f]{3})$/i.exec(String(c).trim());
        if (!s) return null;
        return s[1].split("").map(x => parseInt(x + x, 16));
    }
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
