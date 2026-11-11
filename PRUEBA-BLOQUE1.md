# Sparkline Table by TCViz — bloque 1 (todo lo gratis): qué probar en Desktop

El diagnóstico de la prueba de viabilidad (`PRUEBA-VIABILIDAD.md`, superada) se ha sustituido por el visual real. Se
conserva lo validado: mapeo matrix, subtotales del motor, `expandCollapse` del host, `fetchMoreData` por segmentos
agregados, rejilla virtualizada e identidad de fila con la ruta completa.

- Paquetes (el N más alto de `dist/`, generados con `node build-test.js` y `node build-test.js --free`):
  - `dist/matrixSparklinesFAB7608B939348B490060433D1A28FA6_test.1.0.0.N.pbiviz` → **"Sparkline Table by TCViz (test)"**
  - `dist/matrixSparklinesFAB7608B939348B490060433D1A28FA6_testfree.1.0.0.N.pbiviz` → **"… (test free)"**
  - En el bloque 1 no hay funciones Pro: los dos paquetes deben verse **iguales**. El `_testfree` sirve para comprobar
    que la petición de licencia (preparada para el bloque 2) no rompe nada ni muestra avisos.
- La esquina inferior derecha lleva la marca de compilación (`test AAAA-MM-DD HH:MM v1.0.0.N`). Si no coincide con el
  último paquete, Desktop sirve uno anterior: quita el visual del panel, cierra Desktop, reabre e importa.
- Informe: **solo la copia** `C:\tcviz\datos\demo_rtm\DemoRTM_LineDiag\DemoRTM.pbip`. Una página nueva ("Bloque 1")
  con el visual grande y, al lado, una **tarjeta nativa** con `Ventas netas` y una **tabla nativa** con
  `dim_pdv[id_pdv]` y `Ventas netas` (para comprobar los filtros).

## Escenarios (los de la prueba de viabilidad, con los pozos nuevos)

### A — natural (1.798 hojas, 24 meses)

| Pozo | Campos |
|---|---|
| Rows | `dim_pdv[provincia]` › `dim_pdv[id_comercial]` › `dim_pdv[id_pdv]` |
| Period | `dim_fecha[anio_mes]` |
| Values | `_Medidas[Ventas netas]`, `_Medidas[Margen bruto %]` |
| Target | `_Medidas[Plan ventas netas]` |
| Prior year (Pro) | `_Medidas[Ventas netas AA]` (en el bloque 1 solo sale en el tooltip) |
| Tooltips | `_Medidas[Pedidos]` |

### B — estrés (10.738 hojas, 24 meses)

| Pozo | Campos |
|---|---|
| Rows | `dim_pdv[zona]` › `dim_pdv[id_pdv]` › `dim_familia[familia]` |
| Period | `dim_fecha[anio_mes]` |
| Values | `_Medidas[Ventas netas]`, `_Medidas[Margen bruto %]`, `_Medidas[Ventas netas AA]` |

## Qué mirar

### 1. Carga y filas (A y B, todo expandido: Alt + clic en ▸ de un nivel 1 y, al repintar, de un nivel 2)
- Mientras llegan segmentos, bajo la cabecera: **"Cargando N de …"** (N crece). Al terminar, el aviso desaparece.
  La ventana es ahora de **5.000 filas por segmento** (era 1.000): B debería cargar en ~3 segmentos en vez de 25.
  Apunta el tiempo hasta que desaparece el aviso. Si sale **"Límite de filas alcanzado: se muestran N filas…"**
  (en rojo), apunta N: es el techo de `fetchMoreData` y debe estar por encima de 2.000 hojas.
- Ninguna fila recortada: con A todo expandido, la tabla nativa y el visual deben tener los mismos PDV (1.798).
- Scroll de arriba abajo en B: fluido. El analizador de rendimiento no debe mostrar entradas nuevas al hacer scroll.

### 2. Subtotales del motor y total general
- Fila de provincia / comercial con su minigráfico (el subtotal del motor, como en la prueba).
- `Margen bruto %` en una provincia: debe coincidir con una tarjeta nativa filtrada a esa provincia y a sep-2026, y
  **no** con la suma de sus comerciales.
- Fila **Total** fija abajo: igual que la tarjeta nativa a sep-2026. Se quita en Formato → Rows → Grand total.
- **Nuevo:** Formato → Values → Value shows → *Total of the range*. La cabecera pasa a "Ventas netas · Total" y el
  valor debe ser el de la tarjeta sin filtro de mes (lo da el **subtotal de columna del motor**: `columnSubtotals`
  está ahora activado por defecto). Para `Margen bruto %` el total del rango debe ser el margen del periodo entero,
  no la media de los meses. Si en Desktop sale "Total of the range did not arrive from Power BI", apúntalo: es que el
  host no manda el subtotal de columna y habría que replantearlo.

### 3. Cabecera, Δ y Δ%
- Cabecera de dos líneas: "Ventas netas / sept 2026", "Δ  Δ% / vs ago 2026", el minigráfico con el rango de meses.
- Formato → Values → Change vs → *Same period last year*: la línea pasa a "vs sept 2025" y Δ% debe coincidir con
  `Var % AA` de una tabla nativa para esa fila. (`anio_mes` es texto "2025-09": el visual reconoce AAAA-MM, AAAAMM,
  AAAA-Qn, fechas y "MMM AAAA"; si el eje no lo permite, avisa y compara con el periodo anterior.)
- Δ y Δ% llevan **signo** (+ / −) además del color. Con base 0 o negativa, Δ% sale **vacío** (el tooltip lo explica).
- **Base pequeña (regla):** Δ% sale atenuado cuando |base| < *umbral* % × mediana de |base| de las filas del **mismo
  nivel** con base positiva (umbral por defecto 10 %; Formato → Values → "Dim Δ% on small bases"; 0 lo apaga). El
  tooltip de la fila dice "base pequeña (valor): lee el % con cuidado". En A, busca un PDV con ventas mínimas.
- "A decrease is good" invierte los colores (para costes).

### 4. Minigráficos
- Formato → Sparkline → Type: Line, Area, Column, Win/loss, Bullet. Con Target puesto:
  - Line/Area/Column: línea discontinua del plan.
  - Win/loss: cada mes gana si supera el plan (sin Target, si es > 0); la cabecera dice "vs Plan ventas netas".
  - Bullet: barra con la cifra de la columna de valor y marca vertical del plan; la cabecera dice el periodo.
- Markers: Last (por defecto), First, Maximum, Minimum, Negative points; cada uno con su forma (círculo, cuadrado,
  triángulo arriba/abajo, círculo hueco).
- Un mes sin dato corta la línea (no la une ni la pone a cero): en A, un PDV que abrió o cerró a mitad del rango.
- Scale: *Shared by level* (por defecto: todas las filas del mismo nivel comparten escala; un subtotal no aplasta a
  sus hijos) o *Per row* — la cabecera lo rotula en negrita "Escala: por fila".

### 5. Orden
- Clic en la cabecera de cualquier columna (nombre, valor, Δ, Δ%, 2.ª/3.ª medida): descendente → ascendente →
  orden de Power BI. Ordena **por la cifra que se ve** (último mes o total, según Value shows) dentro de cada padre.
  Editando, el orden se guarda (Formato → Rows → Sort by); en lectura dura hasta que cambien los datos.
- Menú … → Ordenar por → Ventas netas (el orden del host): bajo "Provincia › Comercial › PDV" aparece en cursiva
  "Orden de Power BI: Ventas netas ↓ (todo el rango)", porque el host ordena por el total del rango, no por la cifra
  visible. Comprueba que el rótulo aparece y que el orden coincide con el de una tabla nativa ordenada igual.

### 6. Expandir, contraer y **marcadores con 2 niveles**
- ▸/▾ de una fila: expande/contrae (lo guarda el host). Alt + clic: todo el nivel. Teclado: → expande, ← contrae.
- **Marcador:** expande 2 provincias y, dentro de una, 2 comerciales (nivel 2). Ver → Marcadores → Agregar ("B1").
  Cambia la expansión. Aplica B1: deben volver exactamente las provincias y comerciales expandidos.
  Guarda, cierra, reabre el .pbip: la expansión sigue.
- **Jerarquía a medias:** con A en pantalla, quita `id_pdv` de Rows, contrae todo, y vuelve a poner `id_pdv`. Si el
  host manda solo 2 niveles, debe salir "Mostrando 2 de 3 niveles: usa ▸ para abrir el siguiente." y los comerciales
  con ▸. Al expandir uno, aparecen sus PDV y el aviso se va.

### 7. Selección (y **selección de subtotal**)
- Clic en una hoja → la tarjeta y la tabla nativas se filtran a ese PDV.
- **Clic en un subtotal de comercial** (nivel 2, expandido) → la tarjeta muestra el mismo valor que ese subtotal
  (pasa las identidades de todas sus hojas). Ídem con una provincia. Un subtotal **contraído** pasa la identidad del
  propio nodo (con su ruta): debe filtrar igual.
- Ctrl + clic añade/quita; un segundo clic sobre lo único seleccionado lo quita; clic en el vacío o Escape limpia.
- Selección + marcador: selecciona un subtotal de comercial, crea un marcador, limpia, aplica → la fila vuelve
  resaltada y la tarjeta filtrada.
- Highlight: con otro visual que resalte (un gráfico de barras por familia), las filas sin datos resaltados se atenúan.
- Clic derecho: menú contextual de Power BI sobre la fila.
- Desactiva "Interacciones" del visual (Formato → Editar interacciones → Ninguno sobre la tarjeta, o en el servicio
  con allowInteractions): el clic no filtra.

### 8. Teclado, tooltip, alto contraste, tamaños
- Tab hasta el visual; ↑/↓, Re Pág/Av Pág, Inicio/Fin; Enter/Espacio selecciona (Ctrl para añadir); Escape limpia.
- Tooltip en el minigráfico: el mes bajo el ratón, las medidas de ese mes, "Δ vs mes anterior", plan, AA y tooltips.
  Fuera del minigráfico: la fila con su valor, Δ/Δ% con su base y los avisos (base pequeña, base ≤ 0).
- Windows → alto contraste: solo primer plano y fondo; la selección con contorno.
- Encoge el visual: primero desaparecen la 3.ª y 2.ª medida, luego Δ y Δ%, luego el valor; **nunca** el minigráfico.
- Densidad (Formato → Rows → Density): Compact / Standard / Comfortable.

### 9. Panel, tema, idiomas, inicio, asistente, formato en el lienzo
- Orden del panel: Style template · Values · Sparkline · Markers · Rows · Column headers.
- Report theme (por defecto) sigue el tema del informe (prueba un tema oscuro); Classic, los colores de siempre.
- Desktop en español: panel, cabecera, avisos y asistente en español.
- Visual vacío: pantalla de inicio con los 3 pasos (Rows, Period, Values) que se marcan ✓ al poner cada campo.
- Editando: asistente de 3 pasos abajo a la derecha (tus campos · cómo leerlo · estilo y densidad); ✕ o Finish lo
  cierra (se reabre con Formato → Style template → Setup guide).
- Con la preliminar "Interacción en objeto": clic en la cabecera, el minigráfico, el valor o el nombre → atajos de
  formato de esa tarjeta. En modo formato el clic no filtra.

### 10. Eventos de render
- Analizador de rendimiento: cada update del visual (también los de cada segmento de fetchMoreData) se cierra con su
  "Representación de objeto visual"; scroll, hover, selección, orden por cabecera y teclado no generan entradas.

## Capturas que hay que mandar
1. A todo expandido (cabecera de dos líneas a la vista).
2. B mientras carga ("Cargando N de …") y al terminar (o con el aviso de límite).
3. Value shows = Total of the range con una tarjeta nativa sin mes al lado.
4. Selección de un subtotal de comercial con la tarjeta nativa al lado.
5. Marcador con 2 niveles: antes de cambiar, después de cambiar y después de aplicar B1.
6. "Mostrando 2 de 3 niveles" (si el host lo reproduce).
7. Analizador de rendimiento con las entradas del visual.

## Simulador (Playwright, 11-11-2026)

`python tools/simulador/harness.py [--estres]` tras `node build-test.js` (lee `.tmp/drop/visual.js`). Capturas en
`tools/simulador/capturas/` (no van al repo). Resultado de la última pasada:

| Prueba | Resultado |
|---|---|
| Update con 2.040 hojas × 36 meses × 3 medidas, todo expandido | 13-15 ms (mediana de 5, dos pasadas); 35 filas en el DOM de 2.168 |
| Update con 10.800 hojas × 24 meses (`--estres`) | 46-51 ms |
| Scroll de toda la lista en 240 frames | frame mediana 16,6 ms, p95 18 ms (60 fps) |
| Eventos de render | 18/18 y 7/7 pares SF en las dos páginas (incluidos updates con `segment`); 0 eventos por scroll, hover, selección, teclado, orden y menú |
| Selección | hoja → 1 identidad; subtotal nivel 2 → 17; subtotal nivel 1 → 255; segundo clic → limpia |
| Marcador (callback con claves de otra forma) | casado por `equals`: las 2 hojas salen resaltadas |
| fetchMoreData | un `segment` → 1 petición y "Cargando 72 de …"; `fetchMoreData` = false → aviso de límite |
| Jerarquía a medias | "Mostrando 2 de 3 niveles…" y ▸ en el nivel 2 |
| persistProperties | 0 en lectura (orden por cabecera incluido); 1 por clic en el asistente |
| allowInteractions = false | el clic no selecciona |

Lo que el simulador **no** prueba: el motor (subtotales, total del rango, orden del host), fetchMoreData real,
marcadores ni el formato de números con la cultura de Power BI. Eso es lo de arriba.

## Decisiones del bloque 1 (para revisar)
- **Total of the range** sale del subtotal de columna del motor (`columnSubtotals: true`), nunca sumando meses.
- **Δ y Δ% se refieren siempre al último periodo** (contra el anterior o el mismo del año anterior), también con
  Value shows = Total; la cabecera lo dice ("sept 2026 vs sept 2025").
- **El valor del último periodo es el del último mes con dato del total** (el mismo para todas las filas): si una fila
  no tiene dato ese mes, su valor sale vacío (no se toma un mes anterior sin decirlo). Su minigráfico sí marca su
  último punto real.
- **Win/loss** contra el objetivo si hay Target; si no, contra cero.
- **Bullet** dibuja la cifra de la columna de valor contra el objetivo del mismo periodo (o del total).
- Escala común **por nivel** por defecto; **por fila** rotulada en la cabecera.
- Orden por cabecera: local al momento; editando se guarda con persistProperties (acción explícita del usuario).
- Plan y Prior year declarados como pozos (Pro) para no cambiar el mapeo en el bloque 2; hoy solo salen en el tooltip.
- Ventana de filas 5.000 por segmento (la prueba usó 1.000).
