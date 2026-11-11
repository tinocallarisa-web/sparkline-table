> **Histórico (11-11-2026):** prueba superada. El diagnóstico se sustituyó por el visual real en el bloque 1; lo que se prueba ahora está en `PRUEBA-BLOQUE1.md`.

# Sparkline Table by TCViz — prueba de viabilidad (días 1-2)

Objetivo: demostrar en Power BI Desktop, antes de construir el visual, que el mapeo **matrix** aguanta lo que promete
el debate (`utillaje/notas/sparkline-table-debate.md`). Si falla un criterio de "fracaso", el visual se cancela o se
replantea.

El paquete de esta fase es un **diagnóstico**: una rejilla virtualizada con un minigráfico por fila y, arriba, un panel
de texto que cuenta lo que llega de Power BI. No tiene panel de formato, ni licencia, ni idiomas.

- Paquete: `dist/matrixSparklinesFAB7608B939348B490060433D1A28FA6_test.1.0.0.N.pbiviz` (el N más alto; se genera con
  `node build-test.js`). En Desktop aparece como **"Sparkline Table by TCViz (test)"**.
- La esquina inferior derecha muestra la marca de compilación (`test AAAA-MM-DD HH:MM v1.0.0.N`). Si no coincide con
  la del último paquete, Desktop está sirviendo uno anterior: quita el visual del panel, cierra Desktop, reabre e importa.
- Informe: **solo la copia** `C:\tcviz\datos\demo_rtm\DemoRTM_LineDiag\DemoRTM.pbip`. No abras `DemoRTM\` ni `DemoRTM_EN\`.

## Qué tiene el modelo (leído de la copia, `DemoRTM.SemanticModel\definition\tables\*.tmdl` y los CSV)

| Dato | Valor real | Consecuencia |
|---|---|---|
| Puntos de venta (`dim_pdv[id_pdv]`) | 1.800 (1.798 con ventas) | Una jerarquía con el PDV de hoja **no llega a 2.000 hojas** |
| `dim_pdv[nombre_pdv]` | solo 690 nombres distintos | No usarlo de hoja: fusiona PDV distintos. Usar `id_pdv` |
| Meses (`dim_fecha[anio_mes]`) | **24** (2024-10 … 2026-09) | No hay 36 meses en el modelo. 36 solo se prueba en el simulador |
| `dim_fecha[fecha]` | 730 días | Sirve para probar el techo de columnas (top 400) |
| PDV × familia con ventas | 10.738 combinaciones | Es el escenario de más de 2.000 hojas |

## Escenarios

En una página nueva ("Viabilidad"), un visual Sparkline Table a tamaño grande (media página o más) y, al lado, una
**tarjeta nativa** con `_Medidas[Ventas netas]` y una **tabla nativa** con `dim_pdv[id_pdv]` y `Ventas netas` (sirven
para comprobar el filtrado).

### A — natural (1.798 hojas, 24 meses)

| Pozo | Campos, en este orden |
|---|---|
| Rows | `dim_pdv[provincia]` › `dim_pdv[id_comercial]` › `dim_pdv[id_pdv]` |
| Period | `dim_fecha[anio_mes]` |
| Values | `_Medidas[Ventas netas]`, `_Medidas[Margen bruto %]` |

### B — estrés (10.738 hojas, 24 meses): el que demuestra ≥ 2.000 filas y fetchMoreData

| Pozo | Campos, en este orden |
|---|---|
| Rows | `dim_pdv[zona]` › `dim_pdv[id_pdv]` › `dim_familia[familia]` |
| Period | `dim_fecha[anio_mes]` |
| Values | `_Medidas[Ventas netas]`, `_Medidas[Margen bruto %]`, `_Medidas[Ventas netas AA]` |

### C — techo de columnas (opcional, 5 minutos)

Escenario A cambiando Period por `dim_fecha[fecha]` (730 días). Mirar `COLUMNAS: periodos=`: debería quedarse en 400
(el top de `capabilities.json`). Apuntar el número.

## Cómo se expande todo

- Clic en ▸/▾ de una fila: expande o contrae ese nodo (lo hace el host con `toggleExpandCollapse`; el visual no guarda nada).
- **Alt + clic** en ▸ de una fila: expande o contrae **todo ese nivel**.
- Para tener todas las hojas cargadas: Alt + clic en el ▸ de una fila de nivel 1 y, cuando repinte, Alt + clic en el ▸
  de una fila de nivel 2. Si Alt + clic no hace nada, prueba clic derecho sobre una fila → menú del host → Expandir →
  Todo el nivel, y apúntalo.

## Pasos y qué mirar en el panel de diagnóstico

El panel se pliega con clic en "Diagnóstico ▾". Las líneas clave:

1. **Mapeo y filas** (escenarios A y B, todo expandido)
   - `FILAS: hojas=` → A: 1.798 · B: 10.738 (o el número al que llegue). `nodos por nivel=` debe cuadrar.
   - `FETCHMOREDATA: pedidos= recibidos=` y el estado: **"completo (ya no llega segment)"** o **"⚠ TECHO"** (en rojo).
     Apunta los dos números y la línea `historial de updates de datos` (cada update con datos, su tipo
     Create/Append, las hojas acumuladas y si aún llega `segment`).
   - `tiempo desde el Create hasta tener todos los datos`.
   - `NIVELES: 3` con `canBeExpanded=true` en los tres.
   - `COLUMNAS: periodos=24 (2024-10 … 2026-09)`. Si sale otro orden, apúntalo.
2. **Subtotales del motor**
   - `SUBTOTALES DEL MOTOR`: por nivel 1 y 2, `hijo isSubtotal=` o `values en el nodo=` mayores que 0 y
     **`sin subtotal=0`**.
   - Para `Ventas netas`: "motor = suma de hijos en N/N" (es aditiva). Para `Margen bruto %`: **distinto** en casi todos
     → demuestra que el visual usa el valor del motor y no suma. `total general=` debe coincidir con la tarjeta nativa
     filtrada a sep-2026 (o con una tabla nativa por mes).
3. **Rendimiento** (escenario B, todo expandido)
   - `TIEMPOS (último update con datos)`: modelo, pintado y update completo, en ms.
   - Arrastra la barra de desplazamiento de arriba abajo varias veces y con la rueda: ¿va fluido o a saltos? Después,
     `SCROLL: repintados= media= máx=`.
   - `FILAS: … DOM=` debe quedarse en unas 30-60 filas aunque haya 10.000 (es la virtualización).
4. **Eventos de render**
   - `eventos de render: started= finished= failed=0 updates=` → **"1:1 OK"** siempre: tras cargar, tras scroll, tras
     expandir y tras terminar fetchMoreData. El scroll no debe cambiar los contadores.
   - Ver → **Analizador de rendimiento** → Iniciar grabación → Actualizar objetos visuales; luego expande un nodo y haz
     scroll. Cada entrada del visual debe cerrarse (con "Representación de objeto visual"), ninguna queda abierta.
5. **Marcadores: expandir/contraer y orden**
   - Expande dos o tres nodos concretos y ordena: menú **…** del visual → Ordenar por → `Ventas netas`, descendente
     (si el menú no ofrece "Ordenar por", apúntalo: es un dato del mapeo matrix). `ORDEN:` debe mostrarlo.
   - Ver → Marcadores → Agregar ("B1"). Cambia la expansión y el orden. Haz clic en B1: la expansión y el orden deben
     volver, y `EXPANDIR/CONTRAER: contraídos por nivel=` y `ORDEN:` deben ser los de antes.
   - Guarda, cierra y reabre el .pbip: la expansión debe seguir.
6. **Selección**
   - Clic en una hoja → la tarjeta y la tabla nativas se filtran a ese PDV. `SELECCIÓN: hoja … → 1 identidades`.
   - Clic en un subtotal de nivel 2 → la tarjeta muestra el mismo valor que ese subtotal (último mes con la tarjeta
     filtrada al mes, o el total con la tarjeta sin mes). `SELECCIÓN: subtotal nivel 2 … → N identidades` con N = sus
     hojas cargadas. Si el nodo está contraído se pasa la identidad del propio nodo (apúntalo si filtra bien).
   - Ctrl + clic añade; clic en una zona vacía borra la selección.
   - Selección y marcador: selecciona una hoja, guarda un marcador, borra la selección, aplica el marcador → la fila
     vuelve a salir resaltada.

## Capturas que hay que mandar

1. Escenario A todo expandido, con el panel de diagnóstico entero a la vista.
2. Escenario B al terminar fetchMoreData (o con el aviso ⚠ TECHO), panel entero.
3. Escenario B después de un minuto de scroll (líneas `TIEMPOS`, `SCROLL` y `eventos de render`).
4. Marcador: antes de cambiar, después de cambiar y después de aplicar B1.
5. Selección de un subtotal con la tarjeta nativa al lado.
6. Analizador de rendimiento con las entradas del visual.
7. (Opcional) Escenario C, línea `COLUMNAS`.

## Criterios

**Éxito — se construye el visual:**
- Subtotales del motor en todos los niveles no hoja (`sin subtotal=0`) y `Margen bruto %` distinto de la suma de hijos.
- Escenario B: llegan **≥ 2.000 hojas** con fetchMoreData encadenado; si aparece el techo, que sea por encima de 2.000
  hojas y el aviso se vea.
- Update completo con datos **< 500 ms** en Desktop con todo expandido y scroll sin saltos visibles (`SCROLL máx` por
  debajo de ~16 ms).
- "1:1 OK" en todos los momentos y el analizador de rendimiento sin entradas abiertas.
- Expandir/contraer y orden se restauran con el marcador y al reabrir el archivo, sin que el visual guarde nada.
- La hoja y el subtotal filtran el informe con el valor correcto.

**Fracaso — se cancela o se replantea:**
- Los subtotales no llegan del motor (habría que sumar hijos: prohibido, falsea las medidas no aditivas).
- El estado de expandir/contraer no se restaura con marcadores sin persistProperties.
- El techo de fetchMoreData corta por debajo de 2.000 hojas.
- Pintado > 1 s o scroll a saltos con 2.000 hojas.
- Eventos de render descuadrados que no se puedan cuadrar sin trucos.

**Ni éxito ni fracaso (se apunta y se decide):** "Ordenar por" no disponible en el menú (habría que ordenar en el
visual con `applyCustomSort`), Alt + clic no expande el nivel, el total general no llega.

## Resultado del simulador (Playwright, 11-11-2026)

El simulador no reproduce fetchMoreData real, ni subtotales del motor, ni marcadores: solo mide pintado, scroll,
eventos y el comportamiento del código con un dataView matrix sintético que imita el de Desktop (subtotales como hijo
`isSubtotal`, tipo Top). Scripts en `tools/simulador/` (`harness.py`, `stress.py`; requieren `node build-test.js` antes).

| Escenario | Update completo (modelo + pintado) | Scroll (240 frames, toda la lista) | DOM |
|---|---|---|---|
| 3 niveles × 2.040 hojas × 36 meses × 2 medidas | 31 ms (mediana de 5); modelo ~20 ms, pintado ~4 ms | frame mediana 16,6 ms, p95 18 ms, máx 19 ms (60 fps); repintado medio 2,1 ms, máx 4,6 ms | 25 filas |
| 3 niveles × 10.800 hojas × 24 meses × 2 medidas | 79 ms (mediana de 5); modelo ~50 ms, pintado ~1 ms | frame mediana 16,6 ms, p95 17,8 ms; repintado medio 3,2 ms, máx 6,2 ms | 25 filas |

Comprobado también en el simulador:
- Un update con `metadata.segment` → el visual llama una vez a `fetchMoreData(true)`; el update siguiente sin
  `segment` → no vuelve a pedir.
- Eventos: `SF` exactamente una vez por update (9 updates → 9 pares); 240 repintados de scroll → 0 eventos.
- Clic en hoja → 1 identidad; en subtotal de nivel 2 → 17 (sus hojas); en subtotal de nivel 1 → 255.
- Clic en ▸/▾ → `toggleExpandCollapse` con la identidad del nodo; `persistProperties` nunca se llama.
- Con `Margen bruto %` el panel detecta que el subtotal no es la suma de los hijos (0/118 iguales) y con
  `Ventas netas` que sí (118/118).
