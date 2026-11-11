/*
 * Sparkline Table by TCViz — PRUEBA DE VIABILIDAD (no es el visual real).
 *
 * Mapeo MATRIX: jerarquía de filas (hasta 3 niveles), periodo en columnas, 1-3 medidas, subtotales del motor
 * (rowSubtotals, tipo Top), expandir/contraer del host (expandCollapse + toggleExpandCollapse, sin persistProperties),
 * fetchMoreData en modo segmentos agregados hasta que deja de llegar metadata.segment.
 *
 * Pinta una rejilla VIRTUALIZADA (solo filas visibles + margen, alto fijo, join d3 por clave) con un minigráfico de
 * línea por fila y, arriba, un panel de diagnóstico con lo que llega y lo que cuesta pintarlo.
 *
 * Eventos de render: exactamente un renderingStarted y un renderingFinished (o Failed) por update(). El scroll
 * repinta filas con drawRows(), que NO emite eventos (no es un update).
 *
 * Sin licencia todavía (isPro no se usa). Sin innerHTML, sin red, sin persistProperties.
 */
"use strict";

import powerbi from "powerbi-visuals-api";
import { select, Selection } from "d3-selection";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;
import DataViewMatrixNode = powerbi.DataViewMatrixNode;
import DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import PrimitiveValue = powerbi.PrimitiveValue;

// build-test.js la rellena con "test AAAA-MM-DD HH:MM"; en producción va vacía y no se pinta.
const TEST_STAMP = ""; // TEST_STAMP_MARKER

const ROW_H = 24;          // alto fijo de fila (px)
const MARGIN_ROWS = 10;    // filas de margen por encima y por debajo de la ventana
const INDENT = 14;         // sangría por nivel
const SPARK_W = 140;
const VALUE_W = 90;
const DELTA_W = 64;

interface Row {
    key: string;
    index: number;
    node: DataViewMatrixNode;
    level: number;
    label: string;
    isLeaf: boolean;
    collapsed: boolean | undefined;   // undefined = no se puede expandir
    series: (number | null)[][];      // [medida][periodo]
    subtotalSource: "" | "hijo isSubtotal" | "values del nodo";
    parent: Row | null;
    leafCount: number;
    path: string;                     // d del minigráfico (escala común por nivel)
    lastX: number; lastY: number;
    id: ISelectionId | null;
}

interface Model {
    rows: Row[];                      // todas las filas (árbol aplanado en orden de pintado)
    levels: DataViewHierarchyLevel[];
    periods: string[];
    measures: DataViewMetadataColumn[];
    grandTotal: (number | null)[][] | null;
    nodesPerLevel: number[];
    leaves: number;
    subtotalNodes: number;
    subtotalPerLevel: { hijo: number; nodo: number; sin: number }[];
    colLeaves: number;
    colSubtotals: number;
    collapsedPerLevel: number[];
    expandedPerLevel: number[];
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private events: IVisualEventService;
    private selMgr: ISelectionManager;
    private root: HTMLElement;
    private diagBox: HTMLElement;
    private diagBody: HTMLElement;
    private header: HTMLElement;
    private scroller: HTMLElement;
    private spacer: HTMLElement;
    private layer: Selection<HTMLDivElement, unknown, null, undefined>;
    private stamp: HTMLElement;

    private isPro = false; // ISPRO_MARKER (sin licencia en esta fase; build-test.js lo parchea)
    private model: Model | null = null;
    private allowInteractions = true;
    private diagOpen = true;
    private selectedKeys = new Set<string>();
    private lastDiag: string[] = [];

    // contadores de diagnóstico
    private updates = 0;
    private evStarted = 0;
    private evFinished = 0;
    private evFailed = 0;
    private segRequested = 0;
    private segReceived = 0;
    private ceiling = false;
    private fetchDone = false;
    private lastSegment = "";
    private opKinds: string[] = [];
    private modelMs = 0;
    private paintMs = 0;
    private firstFullMs = 0;
    private scrollDraws = 0;
    private scrollMsTotal = 0;
    private scrollMsMax = 0;
    private domRows = 0;
    private toggles = 0;
    private lastToggle = "";
    private lastSelection = "";
    private scrollRaf = 0;
    private dataMs = 0;
    private createAt = 0;
    private completeMs = -1;
    private history: string[] = [];

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;
        this.selMgr = this.host.createSelectionManager();
        this.selMgr.registerOnSelectCallback((ids: ISelectionId[]) => {
            // Restauración de un marcador: solo se repinta el resaltado. Nunca persistProperties aquí.
            this.selectedKeys = new Set(ids.map(i => i.getKey()));
            this.lastSelection = "marcador/host: " + ids.length + " identidades";
            this.drawRows(false);
        });

        this.root = document.createElement("div");
        this.root.className = "st-root";
        this.root.tabIndex = 0;
        options.element.appendChild(this.root);

        this.diagBox = this.el("div", "st-diag", this.root);
        const bar = this.el("div", "st-diag-bar", this.diagBox);
        bar.textContent = "Diagnóstico ▾ (clic para plegar)";
        bar.addEventListener("click", () => {
            this.diagOpen = !this.diagOpen;
            bar.textContent = this.diagOpen ? "Diagnóstico ▾ (clic para plegar)" : "Diagnóstico ▸ (clic para abrir)";
            this.diagBody.style.display = this.diagOpen ? "block" : "none";
            this.drawRows(false);
        });
        this.diagBody = this.el("div", "st-diag-body", this.diagBox);

        this.header = this.el("div", "st-header", this.root);
        this.scroller = this.el("div", "st-scroller", this.root);
        this.spacer = this.el("div", "st-spacer", this.scroller);
        const layer = this.el("div", "st-layer", this.scroller) as HTMLDivElement;
        this.layer = select(layer);
        this.stamp = this.el("div", "st-stamp", this.root);
        this.stamp.textContent = TEST_STAMP;
        this.stamp.style.display = TEST_STAMP ? "block" : "none";

        this.scroller.addEventListener("scroll", () => {
            if (this.scrollRaf) return;
            this.scrollRaf = requestAnimationFrame(() => {
                this.scrollRaf = 0;
                this.drawRows(true);
            });
        });
        this.scroller.addEventListener("click", (e: MouseEvent) => {
            if (e.target === this.scroller || e.target === this.spacer) {
                if (!this.allowInteractions) return;
                this.selMgr.clear();
                this.selectedKeys.clear();
                this.lastSelection = "borrada";
                this.drawRows(false);
            }
        });
        this.root.addEventListener("contextmenu", (e: MouseEvent) => {
            if (!this.allowInteractions) return;
            e.preventDefault();
            const rowEl = (e.target as HTMLElement).closest(".st-row") as HTMLElement | null;
            const row = rowEl ? this.rowByKey(rowEl.getAttribute("data-key")) : null;
            this.selMgr.showContextMenu(row && row.id ? row.id : ({} as ISelectionId), { x: e.clientX, y: e.clientY });
        });
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        this.evStarted++;
        try {
            this.updates++;
            const t0 = performance.now();
            const hc = this.host.hostCapabilities;
            this.allowInteractions = hc && hc.allowInteractions !== undefined ? hc.allowInteractions : true;
            const ok = (options.operationKind as unknown as number);
            this.opKinds.push(this.opKind(ok) + "/t" + options.type);
            if (this.opKinds.length > 12) this.opKinds.shift();

            const dv: DataView | undefined = options.dataViews && options.dataViews[0];
            const isData = (options.type & 2) !== 0;
            if (isData) this.handleSegments(dv, ok);

            if (dv && dv.matrix && isData) {
                const m0 = performance.now();
                this.model = this.buildModel(dv);
                this.modelMs = performance.now() - m0;
            } else if (isData) {
                this.model = null;
            }

            const p0 = performance.now();
            this.layout();
            this.drawRows(false);
            this.paintMs = performance.now() - p0;
            this.firstFullMs = performance.now() - t0;
            if (isData) {
                this.dataMs = this.firstFullMs;
                if (this.fetchDone && this.completeMs < 0) this.completeMs = performance.now() - this.createAt;
                const md = dv && dv.metadata ? (dv.metadata as unknown as Record<string, unknown>) : null;
                this.history.push("#" + this.updates + " " + this.opKind(ok) + " hojas=" + (this.model ? this.model.leaves : 0) +
                    " segment=" + (md && md.segment ? "sí" : "no") + " " + this.firstFullMs.toFixed(0) + "ms");
                if (this.history.length > 8) this.history.shift();
            }

            this.evFinished++;   // se cuenta antes de pintar el panel: renderingFinished va justo después
            this.lastDiag = this.diagnose(options, dv);
            this.paintDiag();
            this.events.renderingFinished(options);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.evFailed++;
            this.events.renderingFailed(options, msg);
        }
    }

    // ---------------------------------------------------------------- fetchMoreData

    private handleSegments(dv: DataView | undefined, ok: number): void {
        if (ok === 0) {   // Create: consulta nueva → se reinician los contadores de segmentos
            this.segRequested = 0;
            this.segReceived = 0;
            this.ceiling = false;
            this.fetchDone = false;
            this.createAt = performance.now();
            this.completeMs = -1;
        } else {
            this.segReceived++;
        }
        const md = dv && dv.metadata ? (dv.metadata as unknown as Record<string, unknown>) : null;
        const seg = md ? md.segment as Record<string, unknown> | undefined : undefined;
        this.lastSegment = seg === undefined ? "(no llega)" : this.json(seg);
        if (!seg) {
            this.fetchDone = true;
            return;
        }
        if (this.ceiling) return;
        const more = this.host.fetchMoreData(true);
        this.segRequested++;
        if (!more) this.ceiling = true;
    }

    // ---------------------------------------------------------------- modelo

    private buildModel(dv: DataView): Model {
        const mx = dv.matrix;
        const levels = mx.rows.levels || [];
        const measures = mx.valueSources || [];
        const nM = Math.max(1, measures.length);

        // Hojas de columnas → índice de periodo
        const periods: string[] = [];
        const periodIndex = new Map<string, number>();
        const colPeriod: number[] = [];
        let colSubtotals = 0;
        const walkCols = (n: DataViewMatrixNode, periodLabel: string | null) => {
            const lbl = n.level === 0 ? this.nodeLabel(n) : periodLabel;
            if (n.children && n.children.length) {
                n.children.forEach(c => walkCols(c, lbl));
                return;
            }
            if (n.isSubtotal) colSubtotals++;
            const key = lbl === null ? "(único)" : lbl;
            if (!periodIndex.has(key)) { periodIndex.set(key, periods.length); periods.push(key); }
            colPeriod.push(n.isSubtotal ? -1 : periodIndex.get(key));
        };
        walkCols(mx.columns.root, null);
        const nP = Math.max(1, periods.length);

        const seriesOf = (vals: { [id: number]: powerbi.DataViewMatrixNodeValue } | undefined): (number | null)[][] | null => {
            if (!vals) return null;
            const s: (number | null)[][] = [];
            for (let m = 0; m < nM; m++) s.push(new Array(nP).fill(null));
            let any = false;
            Object.keys(vals).forEach(k => {
                const i = Number(k);
                const v = vals[i];
                const p = colPeriod[Math.floor(i / nM)] !== undefined ? colPeriod[Math.floor(i / nM)] : -1;
                const m = v.valueSourceIndex || 0;
                if (p < 0 || m >= nM) return;
                const num = typeof v.value === "number" ? v.value : null;
                s[m][p] = num;
                any = true;
            });
            return any ? s : null;
        };

        const rows: Row[] = [];
        const nodesPerLevel = levels.map(() => 0);
        const collapsedPerLevel = levels.map(() => 0);
        const expandedPerLevel = levels.map(() => 0);
        const subtotalPerLevel = levels.map(() => ({ hijo: 0, nodo: 0, sin: 0 }));
        let leaves = 0, subtotalNodes = 0;
        let grandTotal: (number | null)[][] | null = null;
        const lastLevel = levels.length - 1;

        const walk = (n: DataViewMatrixNode, parent: Row | null, parentKey: string) => {
            const kids = n.children || [];
            const subChild = kids.find(c => c.isSubtotal);
            const real = kids.filter(c => !c.isSubtotal);
            if (subChild) subtotalNodes++;
            if (n.level === undefined || n.level === null) {   // raíz
                grandTotal = subChild ? seriesOf(subChild.values) : seriesOf(n.values);
                real.forEach(c => walk(c, null, ""));
                return;
            }
            const level = n.level;
            nodesPerLevel[level] = (nodesPerLevel[level] || 0) + 1;
            const label = this.nodeLabel(n);
            const key = parentKey + "\u001f" + label;
            // Hoja = último nivel que Power BI manda Y sin poder expandirse. Si el host dejó la jerarquía en un nivel
            // intermedio (los niveles de abajo no vienen en la consulta), el nodo sigue siendo expandible: canBeExpanded
            // del nivel o isCollapsed === true. Antes se trataba como hoja y no salía el ▸.
            const canExpand = n.isCollapsed === true || !!(levels[level] && (levels[level] as any).canBeExpanded);
            const isLeaf = level >= lastLevel && !canExpand && !(n.children && n.children.length);
            let series: (number | null)[][] | null;
            let src: Row["subtotalSource"] = "";
            if (isLeaf) {
                series = seriesOf(n.values);
                leaves++;
            } else if (subChild) {
                series = seriesOf(subChild.values); src = "hijo isSubtotal"; subtotalPerLevel[level].hijo++;
            } else if (n.values && Object.keys(n.values).length) {
                series = seriesOf(n.values); src = "values del nodo"; subtotalPerLevel[level].nodo++;
            } else {
                series = null; subtotalPerLevel[level].sin++;
            }
            if (n.isCollapsed === true) collapsedPerLevel[level]++;
            if (n.isCollapsed === false) expandedPerLevel[level]++;
            let id: ISelectionId | null = null;
            try { id = this.host.createSelectionIdBuilder().withMatrixNode(n, levels).createSelectionId(); } catch { id = null; }
            const row: Row = {
                key, index: rows.length, node: n, level, label, isLeaf, collapsed: isLeaf ? undefined : (n.isCollapsed === undefined ? !(n.children && n.children.length) : n.isCollapsed),
                series: series || [new Array(nP).fill(null)], subtotalSource: src, parent, leafCount: 0,
                path: "", lastX: -1, lastY: -1, id
            };
            rows.push(row);
            real.forEach(c => walk(c, row, key));
            if (isLeaf) { for (let p = parent; p; p = p.parent) p.leafCount++; }
        };
        walk(mx.rows.root, null, "");

        // Minigráficos: escala común POR NIVEL (un subtotal no aplasta a sus hijos)
        const ext = levels.map(() => [Infinity, -Infinity]);
        rows.forEach(r => r.series[0].forEach(v => {
            if (v === null) return;
            const e = ext[r.level];
            if (v < e[0]) e[0] = v;
            if (v > e[1]) e[1] = v;
        }));
        const w = SPARK_W - 8, h = ROW_H - 8;
        rows.forEach(r => {
            const e = ext[r.level];
            const lo = e[0], hi = e[1] > e[0] ? e[1] : e[0] + 1;
            let d = "", pen = false, lx = -1, ly = -1;
            const s = r.series[0];
            for (let p = 0; p < s.length; p++) {
                const v = s[p];
                if (v === null) { pen = false; continue; }
                const x = 4 + (s.length > 1 ? (p / (s.length - 1)) * w : w / 2);
                const y = 4 + h - ((v - lo) / (hi - lo)) * h;
                d += (pen ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
                pen = true; lx = x; ly = y;
            }
            r.path = d; r.lastX = lx; r.lastY = ly;
        });

        return {
            rows, levels, periods, measures, grandTotal, nodesPerLevel, leaves, subtotalNodes, subtotalPerLevel,
            colLeaves: colPeriod.length, colSubtotals, collapsedPerLevel, expandedPerLevel
        };
    }

    // ---------------------------------------------------------------- pintado (virtualizado)

    private layout(): void {
        while (this.header.firstChild) this.header.removeChild(this.header.firstChild);
        const m = this.model;
        const names = m ? m.levels.map(l => l.sources.map(s => s.displayName).join(" + ")).join(" › ") : "";
        const meas = m && m.measures.length ? m.measures[0].displayName : "";
        this.cell(this.header, "st-c-name", names || "Rows");
        this.cell(this.header, "st-c-val", meas ? meas + " (último)" : "");
        this.cell(this.header, "st-c-delta", "Δ%");
        this.cell(this.header, "st-c-spark", m ? m.periods.length + " periodos" : "");
        this.spacer.style.height = (m ? m.rows.length * ROW_H : 0) + "px";
    }

    private drawRows(fromScroll: boolean): void {
        const t0 = performance.now();
        const m = this.model;
        const rows = m ? m.rows : [];
        const top = this.scroller.scrollTop;
        const viewH = this.scroller.clientHeight || 400;
        const start = Math.max(0, Math.floor(top / ROW_H) - MARGIN_ROWS);
        const end = Math.min(rows.length, Math.ceil((top + viewH) / ROW_H) + MARGIN_ROWS);
        const slice = rows.slice(start, end);
        const fmt = (v: number | null, src: DataViewMetadataColumn | undefined) => this.fmtValue(v, src);
        const measure = m && m.measures.length ? m.measures[0] : undefined;

        const sel = this.layer.selectAll<HTMLDivElement, Row>("div.st-row").data(slice, (d: Row) => d.key);
        sel.exit().remove();
        const enter = sel.enter().append("div").attr("class", "st-row");
        const nameCell = enter.append("div").attr("class", "st-c-name");
        nameCell.append("span").attr("class", "st-toggle");
        nameCell.append("span").attr("class", "st-label");
        enter.append("div").attr("class", "st-c-val");
        enter.append("div").attr("class", "st-c-delta");
        const svg = enter.append("svg").attr("class", "st-c-spark").attr("width", SPARK_W).attr("height", ROW_H);
        svg.append("path").attr("class", "st-line");
        svg.append("circle").attr("class", "st-last").attr("r", 2.5);

        const all = enter.merge(sel);
        all.attr("data-key", d => d.key)
            .style("transform", d => "translateY(" + d.index * ROW_H + "px)")
            .classed("st-subtotal", d => !d.isLeaf)
            .classed("st-selected", d => this.isSelected(d))
            .attr("role", "row")
            .attr("aria-level", d => d.level + 1)
            .attr("aria-expanded", d => d.collapsed === undefined ? null : String(!d.collapsed));
        all.select(".st-c-name").style("padding-left", d => (4 + d.level * INDENT) + "px");
        all.select(".st-toggle").text(d => d.collapsed === undefined ? "" : (d.collapsed ? "▸" : "▾"));
        all.select(".st-label").text(d => d.label);
        all.select(".st-c-val").text(d => fmt(this.lastOf(d.series[0]), measure));
        all.select(".st-c-delta").text(d => this.deltaText(d.series[0]));
        all.select("path.st-line").attr("d", d => d.path || null);
        all.select("circle.st-last").attr("cx", d => d.lastX).attr("cy", d => d.lastY).style("display", d => d.lastX < 0 ? "none" : null);

        if (enter.size()) {
            enter.on("click", (e: MouseEvent, d: Row) => this.onRowClick(e, d));
            enter.select(".st-toggle").on("click", (e: MouseEvent, d: Row) => { e.stopPropagation(); this.onToggle(e, d); });
        }
        this.domRows = this.layer.node().childElementCount;
        if (fromScroll) {
            const ms = performance.now() - t0;
            this.scrollDraws++;
            this.scrollMsTotal += ms;
            if (ms > this.scrollMsMax) this.scrollMsMax = ms;
            if (this.scrollDraws % 10 === 0) this.paintDiag();
        }
    }

    // ---------------------------------------------------------------- interacción

    private onToggle(e: MouseEvent, d: Row): void {
        if (!this.allowInteractions || d.collapsed === undefined || !d.id) return;
        const entireLevel = e.altKey;
        this.toggles++;
        this.lastToggle = (d.collapsed ? "expandir " : "contraer ") + "\"" + d.label + "\" nivel " + (d.level + 1) + (entireLevel ? " (nivel entero)" : "");
        // El host guarda el estado (marcadores incluidos) y manda un update nuevo. Sin persistProperties.
        this.selMgr.toggleExpandCollapse(d.id, entireLevel);
        this.paintDiag();
    }

    private onRowClick(e: MouseEvent, d: Row): void {
        if (!this.allowInteractions) return;
        const multi = e.ctrlKey || e.metaKey;
        let ids: ISelectionId[];
        if (d.isLeaf) {
            ids = d.id ? [d.id] : [];
        } else {
            // Subtotal: todas las identidades de sus hojas cargadas; si está contraído, la del propio nodo.
            const leaves = this.leafDescendants(d);
            ids = leaves.length ? leaves.map(r => r.id).filter(x => !!x) as ISelectionId[] : (d.id ? [d.id] : []);
        }
        if (!ids.length) return;
        this.selMgr.select(ids, multi).then((cur: ISelectionId[]) => {
            this.selectedKeys = new Set(cur.map(i => i.getKey()));
            this.drawRows(false);
            this.paintDiag();
        });
        this.lastSelection = (d.isLeaf ? "hoja" : "subtotal nivel " + (d.level + 1)) + " \"" + d.label + "\" → " + ids.length + " identidades" + (multi ? " (Ctrl)" : "");
    }

    private leafDescendants(d: Row): Row[] {
        const m = this.model;
        if (!m) return [];
        const out: Row[] = [];
        const i0 = d.index;
        for (let i = i0 + 1; i < m.rows.length && m.rows[i].level > d.level; i++) {
            if (m.rows[i].isLeaf) out.push(m.rows[i]);
        }
        return out;
    }

    private isSelected(d: Row): boolean {
        if (!this.selectedKeys.size) return false;
        if (d.isLeaf || !d.leafCount) return !!d.id && this.selectedKeys.has(d.id.getKey());
        const leaves = this.leafDescendants(d);
        return leaves.length > 0 && leaves.every(r => !!r.id && this.selectedKeys.has(r.id.getKey()));
    }

    private rowByKey(k: string | null): Row | null {
        if (!k || !this.model) return null;
        return this.model.rows.find(r => r.key === k) || null;
    }

    // ---------------------------------------------------------------- diagnóstico

    private diagnose(options: VisualUpdateOptions, dv: DataView | undefined): string[] {
        const L: string[] = [];
        L.push("SPARKLINE TABLE — viabilidad · update #" + this.updates + (TEST_STAMP ? "  [" + TEST_STAMP + "]" : ""));
        L.push("eventos de render: started=" + this.evStarted + " finished=" + this.evFinished + " failed=" + this.evFailed +
            " updates=" + this.updates + "  → " + (this.evStarted === this.updates && this.evFinished + this.evFailed === this.updates ? "1:1 OK" : "DESCUADRE"));
        L.push("últimos updates (operationKind/type): " + this.opKinds.join(" · "));
        L.push("allowInteractions=" + this.allowInteractions + "  viewport=" + Math.round(options.viewport.width) + "x" + Math.round(options.viewport.height));
        if (!dv || !dv.matrix) {
            L.push("", "Sin dataView matrix: arrastra Rows, Period y Values.");
            return L;
        }
        const m = this.model;
        if (!m) return L;
        L.push("", "FETCHMOREDATA: pedidos=" + this.segRequested + " recibidos=" + this.segReceived +
            "  segment=" + this.lastSegment + "  " + (this.ceiling ? "⚠ TECHO: fetchMoreData devolvió false — datos recortados" :
            this.fetchDone ? "completo (ya no llega segment)" : "en curso…"));
        L.push("  historial de updates de datos: " + this.history.join(" · "));
        L.push("  tiempo desde el Create hasta tener todos los datos: " + (this.completeMs >= 0 ? this.completeMs.toFixed(0) + " ms" : "aún no"));
        L.push("FILAS: hojas=" + m.leaves + "  nodos por nivel=" + m.nodesPerLevel.join(" / ") + "  filas pintables=" + m.rows.length +
            "  DOM=" + this.domRows + " filas");
        L.push("NIVELES: " + m.levels.length + " → " + m.levels.map((l, i) => (i + 1) + ":\"" + l.sources.map(s => s.displayName).join("+") +
            "\" canBeExpanded=" + String(l.canBeExpanded)).join("  "));
        L.push("EXPANDIR/CONTRAER: contraídos por nivel=" + m.collapsedPerLevel.join("/") + "  expandidos=" + m.expandedPerLevel.join("/") +
            "  toggles enviados=" + this.toggles + (this.lastToggle ? "  último: " + this.lastToggle : ""));
        L.push("COLUMNAS: periodos=" + m.periods.length + " (" + (m.periods[0] || "-") + " … " + (m.periods[m.periods.length - 1] || "-") +
            ")  hojas de columna=" + m.colLeaves + "  subtotales de columna=" + m.colSubtotals);
        L.push("MEDIDAS: " + m.measures.map(s => "\"" + s.displayName + "\" format=" + (s.format || "-")).join("  "));
        L.push("ORDEN: " + this.sortInfo(dv));
        L.push("", "SUBTOTALES DEL MOTOR: nodos con hijo isSubtotal=" + m.subtotalNodes + "  total general=" +
            (m.grandTotal ? this.fmtValue(this.lastOf(m.grandTotal[0]), m.measures[0]) + " (último periodo)" : "no llega"));
        m.subtotalPerLevel.forEach((s, lv) => {
            if (lv >= m.levels.length - 1) return;
            L.push("  nivel " + (lv + 1) + ": hijo isSubtotal=" + s.hijo + "  values en el nodo=" + s.nodo + "  sin subtotal=" + s.sin);
            m.measures.forEach((src, mi) => L.push("     " + this.compareSubtotals(m, lv, mi, src)));
        });
        L.push("", "TIEMPOS (último update con datos): modelo=" + this.modelMs.toFixed(1) + " ms  pintado=" + this.paintMs.toFixed(1) +
            " ms  update completo=" + this.dataMs.toFixed(1) + " ms   (último update de cualquier tipo: " + this.firstFullMs.toFixed(1) + " ms)");
        L.push("SCROLL: repintados=" + this.scrollDraws + " (sin eventos de render)  media=" +
            (this.scrollDraws ? (this.scrollMsTotal / this.scrollDraws).toFixed(2) : "-") + " ms  máx=" + this.scrollMsMax.toFixed(2) + " ms");
        L.push("SELECCIÓN: " + (this.lastSelection || "-") + "  seleccionadas ahora=" + this.selectedKeys.size);
        return L;
    }

    // Compara, en el último periodo con dato, el subtotal del motor con la suma de los hijos cargados.
    private compareSubtotals(m: Model, lv: number, mi: number, src: DataViewMetadataColumn): string {
        let iguales = 0, distintos = 0, ejemplo = "";
        m.rows.forEach((r, i) => {
            if (r.level !== lv || r.isLeaf || r.collapsed) return;
            const kids: Row[] = [];
            for (let j = i + 1; j < m.rows.length && m.rows[j].level > lv; j++) if (m.rows[j].level === lv + 1) kids.push(m.rows[j]);
            if (!kids.length) return;
            const s = r.series[mi] || [];
            let p = s.length - 1;
            while (p >= 0 && s[p] === null) p--;
            if (p < 0) return;
            const motor = s[p] as number;
            const suma = kids.reduce((a, k) => a + ((k.series[mi] && k.series[mi][p]) || 0), 0);
            const eq = Math.abs(motor - suma) <= Math.max(1e-9, Math.abs(motor) * 1e-6);
            if (eq) iguales++; else distintos++;
            if (!ejemplo && (!eq || iguales === 1)) ejemplo = "ej. \"" + r.label + "\" motor=" + this.fmtValue(motor, src) + " suma hijos=" + this.fmtValue(suma, src);
        });
        if (!iguales && !distintos) return "\"" + src.displayName + "\": sin nodos expandidos con hijos para comparar";
        return "\"" + src.displayName + "\": motor = suma de hijos en " + iguales + "/" + (iguales + distintos) +
            (distintos ? " (distinto en " + distintos + ": no aditiva → usamos el valor del motor)" : "") + "  " + ejemplo;
    }

    private sortInfo(dv: DataView): string {
        const cols = (dv.metadata && dv.metadata.columns) || [];
        const s = cols.filter(c => c.sort !== undefined).map(c => "\"" + c.displayName + "\" " + (c.sort === 1 ? "asc" : "desc") +
            (c.sortOrder !== undefined ? " (orden " + c.sortOrder + ")" : ""));
        return s.length ? s.join(", ") : "sin orden explícito (orden por defecto del modelo)";
    }

    private paintDiag(): void {
        while (this.diagBody.firstChild) this.diagBody.removeChild(this.diagBody.firstChild);
        const lines = this.lastDiag.slice();
        if (lines.length > 1) {
            lines[1] = "eventos de render: started=" + this.evStarted + " finished=" + this.evFinished + " failed=" + this.evFailed +
                " updates=" + this.updates + "  → " + (this.evStarted === this.updates && this.evFinished + this.evFailed === this.updates ? "1:1 OK" : "par abierto (dentro de update)");
        }
        const sIdx = lines.findIndex(t => t.indexOf("SCROLL:") === 0);
        if (sIdx >= 0) {
            lines[sIdx] = "SCROLL: repintados=" + this.scrollDraws + " (sin eventos de render)  media=" +
                (this.scrollDraws ? (this.scrollMsTotal / this.scrollDraws).toFixed(2) : "-") + " ms  máx=" + this.scrollMsMax.toFixed(2) + " ms";
        }
        const selIdx = lines.findIndex(t => t.indexOf("SELECCIÓN:") === 0);
        if (selIdx >= 0) lines[selIdx] = "SELECCIÓN: " + (this.lastSelection || "-") + "  seleccionadas ahora=" + this.selectedKeys.size;
        const tIdx = lines.findIndex(t => t.indexOf("EXPANDIR/CONTRAER:") === 0);
        if (tIdx >= 0 && this.lastToggle && lines[tIdx].indexOf(this.lastToggle) < 0) lines[tIdx] += "  (pendiente: " + this.lastToggle + ")";
        lines.forEach((t, i) => {
            const d = document.createElement("div");
            d.textContent = t === "" ? " " : t;
            if (i === 0) d.className = "st-diag-title";
            else if (/^[A-ZÁÉÍÓÚ/ ]+[:(]/.test(t)) d.className = "st-diag-h";
            if (t.indexOf("⚠") >= 0 || t.indexOf("DESCUADRE") >= 0) d.className = "st-diag-warn";
            this.diagBody.appendChild(d);
        });
        console.log("[SparklineTable DIAG]\n" + lines.join("\n"));
    }

    // ---------------------------------------------------------------- utilidades

    private el(tag: string, cls: string, parent: HTMLElement): HTMLElement {
        const e = document.createElement(tag);
        e.className = cls;
        parent.appendChild(e);
        return e;
    }

    private cell(parent: HTMLElement, cls: string, text: string): void {
        const c = this.el("div", cls, parent);
        c.textContent = text;
    }

    private nodeLabel(n: DataViewMatrixNode): string {
        if (n.levelValues && n.levelValues.length) return n.levelValues.map(v => this.fmt(v.value)).join(" · ");
        return this.fmt(n.value);
    }

    private lastOf(s: (number | null)[]): number | null {
        for (let i = s.length - 1; i >= 0; i--) if (s[i] !== null) return s[i];
        return null;
    }

    private deltaText(s: (number | null)[]): string {
        let i = s.length - 1;
        while (i >= 0 && s[i] === null) i--;
        let j = i - 1;
        while (j >= 0 && s[j] === null) j--;
        if (i < 0 || j < 0) return "";
        const base = s[j] as number;
        if (base <= 0) return "";   // base 0 o negativa → vacío (honestidad del dato)
        const d = ((s[i] as number) - base) / base * 100;
        return (d > 0 ? "+" : "") + d.toFixed(1) + "%";
    }

    private fmtValue(v: number | null, src: DataViewMetadataColumn | undefined): string {
        if (v === null || v === undefined) return "";
        const f = src && src.format ? src.format : "";
        const loc = this.host.locale || "en-US";
        if (f.indexOf("%") >= 0) return (v * 100).toLocaleString(loc, { maximumFractionDigits: 1 }) + " %";
        return v.toLocaleString(loc, { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 });
    }

    private opKind(k: number): string {
        const names: Record<number, string> = { 0: "Create", 1: "Append", 2: "Segment" };
        return k === undefined ? "undef" : (names[k] || String(k));
    }

    private fmt(v: PrimitiveValue): string {
        if (v === null || v === undefined) return "(en blanco)";
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v);
    }

    private json(v: unknown): string {
        try { return JSON.stringify(v).slice(0, 160); } catch { return String(v); }
    }
}
