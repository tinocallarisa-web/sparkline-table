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
  Ventana de **1.000 filas por segmento** (la validada; 5.000 colgó el escenario A el 12-11 junto con los subtotales
  de columna activados por defecto). Apunta el tiempo hasta que desaparece el aviso. Si sale **"Límite de filas alcanzado: se muestran N filas…"**
  (en rojo), apunta N: es el techo de `fetchMoreData` y debe estar por encima de 2.000 hojas.
- Ninguna fila recortada: con A todo expandido, la tabla nativa y el visual deben tener los mismos PDV (1.798).
- Scroll de arriba abajo en B: fluido. El analizador de rendimiento no debe mostrar entradas nuevas al hacer scroll.

### 2. Subtotales del motor y total general
- Fila de provincia / comercial con su minigráfico (el subtotal del motor, como en la prueba).
- `Margen bruto %` en una provincia: debe coincidir con una tarjeta nativa filtrada a esa provincia y a sep-2026, y
  **no** con la suma de sus comerciales.
- Fila **Total** fija abajo: igual que la tarjeta nativa a sep-2026. Se quita en Formato → Rows → Grand total.
- **Nuevo:** Formato → Values → *Value shows the total of the range* (apagado por defecto). Es el interruptor de
  subtotales de columna del host: solo al encenderlo la consulta pide el total de cada fila. **Pruébalo aparte con A
  todo expandido y apunta si tarda o se cuelga.** La cabecera pasa a "Ventas netas · Total" y el
  valor debe ser el de la tarjeta sin filtro de mes. Para `Margen bruto %` el total del rango debe ser el margen del periodo entero,
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
- Ventana de filas 1.000 por segmento (la validada) y subtotales de columna solo si el usuario los pide.
- Escala por defecto *auto* (propuesta, pendiente de Tino): por fila en el último nivel, común por nivel en los
  subtotales; rotulada "Escala: por fila en el detalle".

## 12-11: cuelgue con id_pdv y opciones nuevas

**Cuelgue (escenario A con id_pdv).** El simulador no lo reproduce (no tiene motor de consultas): 1.800 hojas × 24 meses
con subtotales de filas y columnas cargadas en 3 segmentos dan 13-40 ms por update, 5/5 pares de eventos y ningún
error. Lo que cambió respecto a la prueba de viabilidad, que cargaba A en 671 ms, era la **forma de la consulta**
(ventana 5.000 y subtotales de columna activados por defecto) y la **regla de fetchMoreData** (solo pedir si llegaron
filas nuevas). Las tres cosas vuelven a lo validado. Además: todo error termina en renderingFailed con mensaje en el
visual, la selección ya no se casa con `equals` en cada update y los formateadores se cachean por unidad.
Qué probar primero: A con id_pdv, todo expandido (debe cargar como en la prueba); luego encender *Value shows the
total of the range*.

**Opciones nuevas:**
- Rows → *Row height (px, 0 = automatic)*: 0 = el de la densidad. Si es menor que el texto, manda el texto (texto +
  4 px) y el panel lo dice ("subido a N px…"). Minigráfico, marcadores y último valor se escalan con el alto; la
  cabecera y el total usan el mismo alto mínimo.
- *Row levels*: selector Level 1 / 2 / 3 / Grand total row (según los niveles presentes) con fondo + opacidad, color
  del texto, tamaño (0 = como Rows), fuente, negrita (Automatic = lo de siempre) y cursiva. Alto contraste ignora
  fondos y colores.
- Column headers: fuente, negrita, color y fondo propios. Los nombres largos de medida pasan a dos líneas (nombre
  completo en el title).
## 12-11 (2): alineación, expandir/contraer, tooltips, espaciado e imagen por fila

**Alineación con fuentes por nivel.** El ancho de cada columna se mide con la fuente real de cada nivel (tamaño, familia
y negrita), del total y de la cabecera, y se queda el máximo. Cada columna lleva a la izquierda su hueco (*Rows →
Column spacing*, 16 px por defecto, mínimo 12: antes de bajar de ahí se ocultan columnas). Los números se alinean a la
derecha como bloque: si algo no cupiera se corta por el final con "…" y no por el principio. En la captura de Tino el
Δ del nivel 1 perdía así el signo menos ("760K €"). En el simulador, con el nivel 1 a 16 px en negrita y el 3 a 9 px,
no desborda ninguna celda.

**Expandir/contraer: un clic = un toggle.**
- Clic en el triángulo o en el nombre de una fila expandible = expandir/contraer. Clic en el resto de la fila =
  seleccionar. Para seleccionar un subtotal, pulsa su valor o su minigráfico. Alt + clic en el nombre = el nivel entero.
- Un solo manejador para toda la tabla resuelve la fila por su clave en el momento del clic. Antes cada nodo de fila
  guardaba sus datos de cuando se creó, y la virtualización recicla nodos.
- El clic solo cuenta si se pulsa y se suelta sobre la misma fila (si entre medias llega un update, no hace nada).
- Mientras el host no contesta a un toggle, el triángulo ya enseña el estado pedido, atenuado, y los clics repetidos
  sobre esa fila se ignoran. El update de datos lo libera; si no llegara, se libera a los 4 s.
- Simulador: 4 clics rápidos → 1 toggle (3 ignorados); tras el update se puede volver a pulsar; un update entre
  pulsar y soltar → 0 toggles.
- Qué probar: pulsar varias veces seguidas el nombre de una provincia, también mientras se cargan los segmentos con
  id_pdv.

**Tooltips.** *Rows → Tooltips*: Sparkline only (por defecto), Whole row u Off. Salen a los 300 ms, nunca sobre el nombre
ni el triángulo, nunca con un clic en curso. Se colocan encima o debajo de la fila para no taparla. Se ocultan al
pulsar, al hacer scroll o al salir de la celda.

**Columnas y área desde cero.** Columnas y área arrancan siempre en 0, o en el mínimo si hay negativos, también con la
escala por fila. Las columnas ya lo hacían; el área no, y ahora sí. La línea se ajusta al rango, salvo que se active
*Start at zero*. Con datos que varían ±20 % de un mes a otro, unas columnas desde cero salen casi igual de altas: es
lo honesto. Para ver la forma, usa línea.

**Imagen al inicio de la fila (Pro, con vista previa).**
- Pozo nuevo *Row image (Pro)*: una medida o una columna de texto con resumen *First*. Se evalúa en cada nodo: una
  medida sirve para cualquier nivel; una columna, para su nivel.
- Solo se dibujan valores que empiecen por `data:image/(png|jpeg|gif|webp|bmp|svg+xml);base64,`, como `<image>` SVG
  (sin innerHTML). Una URL http(s) no se carga nunca; editando sale el aviso "Images must be embedded (Base64 data
  URI)".
- *Row levels*, por nivel: Show row image, Image size (0 = alto de fila − 4) e Image shape (cuadrada o redonda).
  *Rows → Reserve space for row images* deja el hueco en los niveles que tienen alguna imagen, para que los nombres
  queden alineados aunque a una fila le falte.
- Por qué Pro: es la clase de gesto que expone el Pro (decoración que pide quien construye un informe para dirección).
  En lectura sin licencia se ve la tabla gratis, sin imágenes ni hueco. Editando sin licencia: imágenes reales con la
  marca de agua "Pro preview · row images" y el aviso de licencia de Power BI.
- Receta (banderas):
  - **Columna:** en la tabla de países, una columna de texto `Bandera` con el data URI de cada bandera (por ejemplo
    `data:image/svg+xml;base64,PHN2Zy…`). Arrástrala a Row image; Power BI la resume con *First* por nodo.
  - **Medida:** `Bandera = SWITCH(SELECTEDVALUE(dim_pdv[provincia]), "Barcelona", "data:image/png;base64,iVBOR…", …)`.
    Ojo: en los niveles de debajo, SELECTEDVALUE sigue devolviendo la provincia, así que apaga *Show row image* en
    esos niveles.
  - En el modelo de prueba basta con una columna calculada en `dim_pdv` con el SWITCH por provincia.
- Tamaño: una bandera SVG de tres franjas ocupa ~300-600 caracteres en Base64 y un PNG de 32×24 px, 1-2 KB. Caben
  holgados. Límite (inferido, no medido aquí): las columnas de texto se truncan a 32.766 caracteres al cargar; una
  medida DAX puede devolver cadenas más largas. Para imágenes grandes, mejor una medida.

## 12-11 (3): curva, color de línea y bandas del bullet (gratis)
- **Sparkline → Curve**: Linear (por defecto), Smooth y Step, para línea y área (filas, subtotales y total).
  - Smooth = `curveMonotoneX`: nunca se pasa de los datos.
  - Step = `curveStep`, el escalón centrado: cada mes ocupa su mitad a cada lado, así el escalón acaba en el último
    punto. Se elige este frente a StepAfter, que lo alargaría medio periodo.
  - Los huecos siguen cortando la línea (`defined`).
- **Sparkline → Line colour**:
  - Neutral (lo de siempre): gris con el último punto en color.
  - Per row: paleta del tema, estable por clave de fila; los subtotales llevan el color de su nivel.
  - By trend: el verde o rojo de la columna Δ según el último valor frente a la base de *Change vs*. Respeta *A decrease
    is good*; sin base, neutro.
  - Con Per row y By trend, máximo y mínimo van en el color de la fila (la forma los distingue).
  - El alto contraste manda sobre todo esto.
- **Qualitative bands** (tarjeta propia; nombres de Bullet Chart Pro: `showBands`, `band1Pct`, `band2Pct`,
  `band1Color`-`band3Color`): solo con el tipo Bullet y un objetivo positivo.
  - Por defecto: malo < 80 % del objetivo, regular 80-95 %, bueno ≥ 95 %.
  - *Lower is better* refleja los umbrales alrededor del 100 %: bueno ≤ 105 %, malo > 120 %.
  - Colores suaves por defecto: rojo #F6CFCB, ámbar #FBE7B5, verde #CDE8CF.
  - La barra del valor y la marca del objetivo van encima, con un 10 % de aire sobre el objetivo para que se vea la
    banda buena.
  - El tooltip dice la banda: "Malo (53,9 % del objetivo)".
  - En alto contraste, solo los contornos.

## 12-11 (4): fase A, gratis — barras de fondo, expandir/contraer todo, buscador
- **Values → Data bars behind the value** (apagado por defecto, como la matriz nativa), con su color propio.
  - Barra tenue bajo la cifra, desde cero, con escala común por nivel (un subtotal no aplasta a sus hijos).
  - Los negativos crecen hacia la izquierda, en el rojo de la columna Δ.
  - No se pinta en alto contraste.
- **Expandir / contraer todo:** botones ⊞ / ⊟ en la cabecera de la jerarquía (Column headers → *Expand / collapse
  all buttons*, encendido por defecto).
  - ⊞ llama a `toggleExpandCollapse(id, true)` sobre un nodo contraído. Como los niveles de abajo solo existen tras su
    update, se encadena: un paso por update de datos, lanzado con `setTimeout` fuera de `update()` (eventos 1:1),
    como mucho 3 pasos.
  - ⊟ contrae el nivel 1.
  - Por nivel: Alt + clic en el nombre de una fila, o el menú contextual del propio Power BI (Expandir/Contraer → Todo
    el nivel), que sale porque el visual declara `expandCollapse`.
  - Qué probar: que ⊞ abra los 3 niveles de A en 2 pasos y que ⊟ los cierre. Si en Desktop el toggle de nivel entero
    con un nodo contraído no expandiera todo el nivel, apúntalo.
- **Buscador:** Column headers → *Search box* (apagado por defecto).
  - Filtra solo a la vista las filas cargadas, en cualquier nivel, sin tener en cuenta mayúsculas ni acentos.
  - Enseña cada coincidencia con su ruta (antepasados), subrayada, con el contador "N coincidencias".
  - No filtra el informe, no se guarda y no emite eventos de render. Escape lo borra.
  - Solo busca en lo cargado: lo que está contraído no se encuentra hasta expandirlo.
