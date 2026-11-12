/*
 * Sparkline Table by TCViz — del dataView MATRIX al árbol de filas.
 *
 * Lo validado en Desktop en la prueba de viabilidad (PRUEBA-VIABILIDAD.md) y que aquí no se cambia:
 *  - Subtotales SIEMPRE del motor: un nodo expandido trae un hijo isSubtotal (rowSubtotalsType Top) y uno contraído
 *    trae sus values en el propio nodo. Nunca se suman hijos (Margen % 51,3 % del motor frente a 618,6 % sumando).
 *  - La identidad de cada fila lleva TODA la ruta (withMatrixNode de cada antepasado y del nodo): "KAM-01" existe en
 *    varias provincias.
 *  - Un nodo del último nivel recibido puede ser expandible (canBeExpanded del nivel o isCollapsed === true): el host
 *    puede dejar la jerarquía a medias.
 * Nuevo en el bloque 1:
 *  - Columnas: subtotal de columna del motor (columnSubtotals) = "Total of the range" de cada fila, sin sumar periodos.
 *  - Las hojas de columna pueden llevar o no el nivel de medidas (con una sola medida no existe): la clave de cada
 *    value se resuelve contra la lista de hojas en los dos casos.
 */
import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewMatrixNodeValue = powerbi.DataViewMatrixNodeValue;
import DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import ISelectionId = powerbi.visuals.ISelectionId;
import PrimitiveValue = powerbi.PrimitiveValue;

export type Num = number | null;

export interface Period {
    raw: PrimitiveValue;
    src: DataViewMetadataColumn | null;
    /** Índice del mismo periodo del año anterior, o -1 si el eje no lo permite / no está. */
    ly: number;
}

export interface Row {
    key: string;
    /** -1 = total general. */
    level: number;
    label: string;
    isLeaf: boolean;
    expandable: boolean;
    collapsed: boolean;
    parent: Row | null;
    children: Row[];
    id: ISelectionId | null;
    /** [índice de valueSources][periodo] */
    s: Num[][];
    /** [índice de valueSources]: subtotal de columna del motor (total del rango). */
    tot: Num[];
    /** Formato dinámico (general.formatString) por punto, solo si llega alguno. */
    fmt: (string | undefined)[][] | null;
    totFmt: (string | undefined)[] | null;
    /** Highlight de la primera medida de Values, por periodo (null si no hay highlight en el dataView). */
    hl: Num[] | null;
    /**
     * Formato condicional (fx) que Power BI evalúa por celda: objects de cada value por periodo (clave = índice del
     * periodo, "t" = total del rango) y los del propio nodo. Solo se guarda si trae values/sparkline.
     */
    fx: Record<string, any> | null;
    fxNode: any;
    /** Valor de texto del rol Row image (el primero no vacío del nodo); se valida al dibujar. */
    img: string | null;
    /** Orden en el que lo mandó el host entre sus hermanos. */
    hostOrder: number;
    // Derivados en cada render (visual.ts)
    index: number;
    shown: Num[];
    shownFmt: (string | undefined)[];
    cur: Num;
    base: Num;
    delta: Num;
    deltaPct: Num;
    /** Bloque 2: referencias a la vista [Plan, Prior year, Forecast] (motor), base de la varianza y varianza. */
    refs: Num[];
    vref: Num;
    vabs: Num;
    vpct: Num;
    /** Estado por umbral: 1 malo, 2 neutro, 3 bueno, 0 sin dato. */
    status: number;
    small: boolean;
    highlighted: boolean;
    spark: unknown;
}

export interface Model {
    roots: Row[];
    all: Row[];
    total: Row | null;
    levels: DataViewHierarchyLevel[];
    /** Campos en el pozo Rows (puede ser mayor que levels.length si el host dejó la jerarquía a medias). */
    rowFields: number;
    periods: Period[];
    sources: DataViewMetadataColumn[];
    valueIdx: number[];
    targetIdx: number;
    planIdx: number;
    pyIdx: number;
    fcIdx: number;
    tipIdx: number[];
    imgIdx: number;
    hasTotals: boolean;
    hasHighlights: boolean;
    /** Llega alguna regla fx evaluada (celda o nodo). */
    hasFx: boolean;
    leaves: number;
    /** El último nivel recibido se puede seguir expandiendo (jerarquía a medias). */
    lastLevelExpandable: boolean;
    /** Último periodo con dato de la primera medida en cualquier fila. */
    lastIdx: number;
    /** Valores que llegan en un periodo vacío del eje ((Blank)): no se dibujan ni cuentan como "último periodo". */
    blankValues: number;
}

export type IdMaker = (path: DataViewMatrixNode[], node: DataViewMatrixNode, levels: DataViewHierarchyLevel[]) => ISelectionId | null;

const hasRole = (c: DataViewMetadataColumn, r: string): boolean => !!(c.roles && c.roles[r]);

export function buildModel(dv: DataView, mkId: IdMaker): Model | null {
    const mx = dv.matrix;
    if (!mx || !mx.rows || !mx.columns) return null;
    const levels = mx.rows.levels || [];
    const sources = mx.valueSources || [];
    const nM = Math.max(1, sources.length);
    const valueIdx: number[] = [];
    const tipIdx: number[] = [];
    let targetIdx = -1, planIdx = -1, pyIdx = -1, fcIdx = -1, imgIdx = -1;
    sources.forEach((s, i) => {
        if (hasRole(s, "values")) valueIdx.push(i);
        else if (hasRole(s, "target") && targetIdx < 0) targetIdx = i;
        else if (hasRole(s, "rowImage") && imgIdx < 0) imgIdx = i;
        else if (hasRole(s, "plan") && planIdx < 0) planIdx = i;
        else if (hasRole(s, "previousYear") && pyIdx < 0) pyIdx = i;
        else if (hasRole(s, "forecast") && fcIdx < 0) fcIdx = i;
        else if (hasRole(s, "tooltips")) tipIdx.push(i);
    });
    const rowFields = (dv.metadata?.columns || []).filter(c => hasRole(c, "rows")).length;

    // ── Columnas: hoja → periodo / total / medida ──────────────────────────
    const colLevels = mx.columns.levels || [];
    const lastColLevel = colLevels.length ? colLevels[colLevels.length - 1] : null;
    const measureLevel = !!lastColLevel && lastColLevel.sources.length > 0 && lastColLevel.sources.every(s => !!s.isMeasure);
    const periodLevel = measureLevel ? colLevels.length - 2 : colLevels.length - 1;
    const periods: Period[] = [];
    const periodIndex = new Map<string, number>();
    const leafPeriod: number[] = [];
    const leafMeasure: number[] = [];
    // Periodo vacío ((Blank): filas sin fecha) fuera del eje, salvo que sea el único periodo.
    const realCols = (mx.columns.root.children || []).filter(c => !c.isSubtotal).length;
    const isBlank = (v: PrimitiveValue): boolean => v === null || v === undefined || v === "";
    const walkCols = (n: DataViewMatrixNode, pIdx: number, sub: boolean): void => {
        let p = pIdx;
        const isSub = sub || !!n.isSubtotal;
        if (!isSub && n.level === periodLevel && periodLevel >= 0) {
            const lv = n.levelValues && n.levelValues.length ? n.levelValues[0] : null;
            const raw = lv ? lv.value : n.value;
            const src = colLevels[periodLevel]?.sources?.[lv ? lv.levelSourceIndex || 0 : 0] || null;
            if (isBlank(raw) && realCols > 1) {
                if (n.children && n.children.length) { for (const c of n.children) walkCols(c, -3, isSub); return; }
                leafPeriod.push(-3); leafMeasure.push(measureLevel ? (n.levelSourceIndex ?? 0) : -1);
                return;
            }
            const k = keyOf(raw);
            let i = periodIndex.get(k);
            if (i === undefined) { i = periods.length; periodIndex.set(k, i); periods.push({ raw, src, ly: -1 }); }
            p = i;
        }
        if (n.children && n.children.length) {
            for (const c of n.children) walkCols(c, p, isSub);
            return;
        }
        leafPeriod.push(isSub ? -2 : pIdx === -3 ? -3 : (periodLevel < 0 ? 0 : p));
        leafMeasure.push(measureLevel ? (n.levelSourceIndex ?? (n.levelValues?.[0]?.levelSourceIndex ?? 0)) : -1);
    };
    walkCols(mx.columns.root, -1, false);
    if (periodLevel < 0 || !periods.length) periods.push({ raw: null, src: null, ly: -1 });
    const nP = periods.length;
    linkLastYear(periods);

    let hasTotals = false, hasHighlights = false, anyFmt = false, hasFx = false, blankValues = 0;
    const isFx = (o: any): boolean => !!o && (!!o.values || !!o.sparkline);
    const fill = (vals: { [id: number]: DataViewMatrixNodeValue } | undefined, r: Row): void => {
        if (!vals) return;
        for (const k of Object.keys(vals)) {
            const i = Number(k);
            const v = vals[i];
            if (!v) continue;
            const leaf = measureLevel ? i : Math.floor(i / nM);
            const p = leafPeriod[leaf];
            if (p === undefined) continue;
            const m = v.valueSourceIndex ?? (measureLevel ? leafMeasure[leaf] : i % nM);
            if (m < 0 || m >= nM) continue;
            if (m === imgIdx) { if (!r.img && typeof v.value === "string" && v.value) r.img = v.value; continue; }
            const num = typeof v.value === "number" && isFinite(v.value) ? v.value : null;
            if (p === -3) { if (num !== null && r.isLeaf) blankValues++; continue; }
            const f = (v.objects as any)?.general?.formatString;
            if (isFx(v.objects)) {
                if (!r.fx) r.fx = {};
                const key = p === -2 ? "t" : String(p);
                r.fx[key] = Object.assign(r.fx[key] || {}, v.objects);
                hasFx = true;
            }
            if (p === -2) {
                r.tot[m] = num;
                hasTotals = true;
                if (typeof f === "string" && f) { if (!r.totFmt) r.totFmt = []; r.totFmt[m] = f; anyFmt = true; }
                continue;
            }
            if (p < 0) continue;
            r.s[m][p] = num;
            if (typeof f === "string" && f) {
                if (!r.fmt) r.fmt = sources.map(() => new Array(nP));
                r.fmt[m][p] = f;
                anyFmt = true;
            }
            if (v.highlight !== undefined && m === valueIdx[0]) {
                if (!r.hl) r.hl = new Array(nP).fill(null);
                r.hl[p] = typeof v.highlight === "number" ? v.highlight : null;
                hasHighlights = true;
            }
        }
    };
    const newRow = (key: string, level: number, label: string, parent: Row | null, order: number): Row => ({
        key, level, label, isLeaf: false, expandable: false, collapsed: false, parent, children: [], id: null,
        s: sources.map(() => new Array(nP).fill(null)), tot: sources.map(() => null), fmt: null, totFmt: null, hl: null, img: null, fx: null, fxNode: null,
        hostOrder: order, index: -1, shown: [], shownFmt: [], cur: null, base: null, delta: null, deltaPct: null,
        refs: [null, null, null], vref: null, vabs: null, vpct: null, status: 0, small: false,
        highlighted: false, spark: null,
    });

    const all: Row[] = [];
    const roots: Row[] = [];
    let total: Row | null = null;
    let leaves = 0;
    const lastLevel = levels.length - 1;
    const lastLevelExpandable = lastLevel >= 0 && !!levels[lastLevel]?.canBeExpanded;

    const root = mx.rows.root;
    const rootKids = root.children || [];
    const rootSub = rootKids.find(c => c.isSubtotal);
    if (rootSub || (root.values && Object.keys(root.values).length && !rootKids.length)) {
        total = newRow("\u001ftotal", -1, "", null, -1);
        fill((rootSub || root).values, total);
    }

    const walk = (n: DataViewMatrixNode, parent: Row | null, parentKey: string, path: DataViewMatrixNode[], order: number): void => {
        const level = n.level ?? 0;
        const label = nodeLabel(n);
        const key = parentKey + "\u001f" + label;
        const kids = n.children || [];
        const subChild = kids.find(c => c.isSubtotal);
        const real = kids.filter(c => !c.isSubtotal);
        // El pozo admite 3 campos: un nodo del 3.er nivel nunca se expande, diga lo que diga canBeExpanded.
        const canExpand = n.isCollapsed === true || (level < 2 && !!levels[level]?.canBeExpanded);
        const isLeaf = level >= lastLevel && !canExpand && !real.length;
        const r = newRow(key, level, label, parent, order);
        r.isLeaf = isLeaf;
        r.expandable = !isLeaf;
        r.collapsed = !isLeaf && (n.isCollapsed === true || !real.length);
        if (isLeaf) { fill(n.values, r); leaves++; }
        else if (subChild) fill(subChild.values, r);
        else fill(n.values, r);
        r.id = mkId(path, n, levels);
        if (isFx((n as any).objects)) { r.fxNode = (n as any).objects; hasFx = true; }
        all.push(r);
        if (parent) parent.children.push(r); else roots.push(r);
        const sub = path.concat([n]);
        real.forEach((c, i) => walk(c, r, key, sub, i));
    };
    rootKids.filter(c => !c.isSubtotal).forEach((c, i) => walk(c, null, "", [], i));

    // Último periodo con dato de la primera medida (en el total general si llega; si no, en cualquier fila).
    let lastIdx = -1;
    const m0 = valueIdx.length ? valueIdx[0] : -1;
    if (m0 >= 0) {
        const scan = (r: Row) => { const s = r.s[m0]; for (let p = nP - 1; p > lastIdx; p--) if (s[p] !== null) { lastIdx = p; break; } };
        if (total) scan(total);
        if (lastIdx < 0) all.forEach(scan);
    }
    void anyFmt;
    return {
        roots, all, total, levels, rowFields, periods, sources, valueIdx, targetIdx, planIdx, pyIdx, fcIdx, tipIdx, imgIdx,
        hasTotals, hasHighlights, hasFx, leaves, lastLevelExpandable, lastIdx, blankValues,
    };
}

/** Filas en orden de pintado: el orden del host, o el del comparador entre hermanos (los hijos siguen a su padre). */
export function flatten(roots: Row[], cmp: ((a: Row, b: Row) => number) | null): Row[] {
    const out: Row[] = [];
    const order = (list: Row[]): Row[] => cmp ? list.slice().sort((a, b) => cmp(a, b) || a.hostOrder - b.hostOrder) : list;
    const stack: Row[] = order(roots).slice().reverse();
    while (stack.length) {
        const r = stack.pop() as Row;
        r.index = out.length;
        out.push(r);
        if (r.children.length) {
            const kids = order(r.children);
            for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
        }
    }
    return out;
}

/**
 * Identidades que representa una fila: la hoja, la suya; un subtotal expandido, las de TODAS sus hojas cargadas
 * (y la del propio nodo para cada descendiente contraído, que no trae hojas); un subtotal contraído, la suya.
 */
export function selectionIdsOf(r: Row): ISelectionId[] {
    const out: ISelectionId[] = [];
    const stack: Row[] = [r];
    while (stack.length) {
        const x = stack.pop() as Row;
        if (x.isLeaf || x.collapsed || !x.children.length) { if (x.id) out.push(x.id); continue; }
        for (let i = x.children.length - 1; i >= 0; i--) stack.push(x.children[i]);
    }
    return out;
}

export function nodeLabel(n: DataViewMatrixNode): string {
    if (n.levelValues && n.levelValues.length) return n.levelValues.map(v => primitiveText(v.value)).join(" · ");
    return primitiveText(n.value);
}

export function primitiveText(v: PrimitiveValue): string {
    if (v === null || v === undefined) return "(Blank)";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return String(v);
}

function keyOf(v: PrimitiveValue): string {
    if (v instanceof Date) return "d" + v.getTime();
    return typeof v + ":" + String(v);
}

// ── Mismo periodo del año anterior ─────────────────────────────────────────

const MONTHS: Record<string, number> = {
    jan: 1, ene: 1, gen: 1, janv: 1, feb: 2, fev: 2, fév: 2, févr: 2, mar: 3, mär: 3, mrt: 3, apr: 4, abr: 4, avr: 4, may: 5, mai: 5, mag: 5, mei: 5,
    jun: 6, juin: 6, giu: 6, jul: 7, juil: 7, lug: 7, aug: 8, ago: 8, août: 8, sep: 9, set: 9, sept: 9, oct: 10, out: 10, okt: 10, ott: 10,
    nov: 11, dec: 12, dic: 12, dez: 12, déc: 12,
};

/** Clave "año|subperiodo" de un periodo, o null si el eje no deja saber qué periodo es el del año anterior. */
export function periodYearKey(v: PrimitiveValue): { y: number; sub: string } | null {
    if (v instanceof Date) return { y: v.getFullYear(), sub: "d" + (v.getMonth() + 1) + "-" + v.getDate() };
    if (typeof v === "number" && isFinite(v)) {
        if (v >= 190001 && v <= 299912 && v % 100 >= 1 && v % 100 <= 12) return { y: Math.floor(v / 100), sub: "m" + (v % 100) };
        if (v >= 1900 && v <= 2999 && Math.floor(v) === v) return { y: v, sub: "" };
        return null;
    }
    if (typeof v !== "string") return null;
    const s = v.trim();
    let m = /^(\d{4})[-/.\s](\d{1,2})$/.exec(s) || /^(\d{4})(\d{2})$/.exec(s);
    if (m && +m[2] >= 1 && +m[2] <= 12) return { y: +m[1], sub: "m" + (+m[2]) };
    m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
    if (m && +m[1] >= 1 && +m[1] <= 12) return { y: +m[2], sub: "m" + (+m[1]) };
    m = /^(\d{4})\s*[-/ ]?\s*[QqTt](\d)$/.exec(s);
    if (m) return { y: +m[1], sub: "q" + m[2] };
    m = /^[QqTt](\d)\s*[-/ ]?\s*(\d{4})$/.exec(s);
    if (m) return { y: +m[2], sub: "q" + m[1] };
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (m) return { y: +m[1], sub: "d" + (+m[2]) + "-" + (+m[3]) };
    m = /^([A-Za-zÀ-ÿ]{3,5})\.?[\s\-/']+(\d{2}|\d{4})$/.exec(s);
    if (m) {
        const mo = MONTHS[m[1].toLowerCase()] ?? MONTHS[m[1].toLowerCase().slice(0, 3)];
        if (mo) return { y: m[2].length === 2 ? 2000 + +m[2] : +m[2], sub: "m" + mo };
    }
    if (/^\d{4}$/.test(s)) return { y: +s, sub: "" };
    return null;
}

/** Mes (1-12) y año de un periodo mensual, para rotularlo con el idioma del informe ("sep 2026"). */
export function periodMonth(v: PrimitiveValue): { y: number; m: number } | null {
    if (v instanceof Date) return null;
    const k = periodYearKey(v);
    if (!k || k.sub[0] !== "m") return null;
    return { y: k.y, m: Number(k.sub.slice(1)) };
}

function linkLastYear(periods: Period[]): void {
    const idx = new Map<string, number>();
    const keys = periods.map(p => periodYearKey(p.raw));
    keys.forEach((k, i) => { if (k) idx.set(k.y + "|" + k.sub, i); });
    keys.forEach((k, i) => {
        if (!k) return;
        const j = idx.get((k.y - 1) + "|" + k.sub);
        periods[i].ly = j === undefined ? -1 : j;
    });
}
