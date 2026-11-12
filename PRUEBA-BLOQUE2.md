# Sparkline Table by TCViz — bloque 2 (Pro): qué probar en Desktop

Todo lo del bloque 1 (`PRUEBA-BLOQUE1.md`) sigue igual y conviene repasar los puntos 1, 2, 6 y 7 (carga, subtotales,
marcadores, selección) con los pozos nuevos puestos: el bloque 2 no toca el mapeo validado (ventana 1.000,
`columnSubtotals` solo con *Total of the range*, `fetchMoreData` en cada update con `segment`).

**Único cambio en la consulta:** pozo nuevo **Forecast (Pro)**, añadido al final del `select` de values. Sin campo en él
la consulta es la misma; **con** campo, Power BI pide una medida más. Comprobar en el escenario A que la carga y el
cuelgue del 12-11 no vuelven (apunta el tiempo hasta que desaparece "Cargando…").

## Paquetes

El N más alto de `dist/`, generados con `node build-test.js` y `node build-test.js --free`:

- `dist/matrixSparklinesFAB7608B939348B490060433D1A28FA6_test.1.0.0.N.pbiviz` → **"Sparkline Table by TCViz (test)"**:
  Pro forzado, todo se dibuja sin marca.
- `dist/matrixSparklinesFAB7608B939348B490060433D1A28FA6_testfree.1.0.0.N.pbiviz` → **"… (test free)"**: licencia real
  (sin plan para el GUID de test = gratis). Editando: vista previa con marca de agua que nombra las funciones y aviso de
  Power BI (barra amarilla y, ~10 s después, el botón de Upgrade). En lectura: la tabla gratis, con Plan / AA / FC en
  **gris** (no un hueco) y sin varianza, estado, minigráficos 2-3, estilos, fx, imágenes ni horizon.
- Marca de compilación abajo a la derecha (`test AAAA-MM-DD HH:MM v1.0.0.N`): si no coincide, Desktop sirve un
  paquete anterior (quita el visual del panel, cierra Desktop, reabre e importa).

## Informe

**Solo la copia** `C:\tcviz\datos\demo_rtm\DemoRTM_LineDiag\DemoRTM.pbip`. Página nueva "Bloque 2", visual grande y,
al lado, una tarjeta nativa con `Ventas netas` y otra con `Plan ventas netas` (para cuadrar subtotales).

| Pozo | Campos |
|---|---|
| Rows | `dim_pdv[provincia]` › `dim_pdv[id_comercial]` › `dim_pdv[id_pdv]` |
| Period | `dim_fecha[anio_mes]` |
| Values | `_Medidas[Ventas netas]`, `_Medidas[Margen bruto %]` |
| Plan (Pro) | `_Medidas[Plan ventas netas]` |
| Prior year (Pro) | `_Medidas[Ventas netas AA]` |
| Forecast (Pro) | (opcional) cualquier medida en € — p. ej. `Plan ventas netas` otra vez, solo para ver la columna |

## 1. Plan / Prior year / Forecast y varianza

- Columnas **Plan ventas netas** y **Ventas netas AA** en gris, con la cifra del mes a la vista (o del rango con
  *Value shows the total of the range*). Luego **ΔPL**, la **barra** y **ΔPL%**, con la línea "vs Plan ventas netas".
- **Subtotal del motor:** en una provincia, `Plan ventas netas` debe coincidir con la tarjeta nativa filtrada a esa
  provincia y a sep-2026, y ΔPL = Ventas netas − Plan **de esa fila** (no la suma de los ΔPL de sus comerciales).
- Barra: eje en el centro; a la derecha si el real supera al plan, a la izquierda si no; verde = favorable, rojo =
  desfavorable. Formato → Values → *A decrease is good* invierte los colores. Escala común por nivel (los comerciales
  no quedan aplastados por la provincia).
- Formato → **Variance (Pro)**: *Compare with* (Plan; si no hay, Prior year / Plan / Prior year / Forecast), y
  apagar ΔPL, ΔPL% o la barra por separado. *Reference columns* quita las columnas grises.
- Δ% con base 0 o negativa → **vacío**, y el tooltip dice por qué.
- Orden: clic en la cabecera ΔPL / ΔPL% (y Rows → Sort by → Variance).
- **Filas sin real** (Rows → *Rows without actual*: **Hide** por defecto / Show). Ver "Causa y receta" abajo. Con un
  plan definido por provincia, en *Show* aparecen comerciales con solo el plan (COM-09, TV-01…); en *Hide* desaparecen
  y la cabecera de nombres dice "n filas sin real ocultas". Los subtotales no cambian (son los del motor).
- **Unidades distintas:** pon `Plan litros` en Plan. Editando sale en rojo "Plan litros y Ventas netas usan formatos
  distintos: la desviación puede no tener sentido". No bloquea nada y en lectura no sale.
- Con el `_testfree`: en lectura, Plan / AA en gris y sin ΔPL; editando, marca "Vista previa Pro · columnas de
  desviación" y el aviso de Power BI. Apagar la tarjeta Variance quita la marca.

### Causa y receta: filas con solo el plan

Si la medida de Plan está definida a otro nivel de detalle que las filas (p. ej. el plan es por provincia y las filas
bajan a comercial), Power BI no puede repartirlo y **repite el plan de la provincia en cada comercial de la
dimensión**, también en los que no vendieron allí. Es el motor (la matriz nativa hace lo mismo con "Mostrar elementos
sin datos" o con medidas que nunca devuelven BLANK). El visual las oculta por defecto; la solución de fondo es que el
plan solo devuelva valor donde corresponde:

```DAX
Plan ventas netas (solo donde hay real) =
IF ( NOT ISBLANK ( [Ventas netas] ), [Plan ventas netas] )
```

o, si el plan es por provincia y no debe bajar de ese nivel:

```DAX
Plan ventas netas (nivel provincia) =
IF ( ISINSCOPE ( dim_pdv[id_comercial] ), BLANK (), [Plan ventas netas] )
```

(Para la FAQ de `support.html`: misma explicación y las dos recetas.)

## 2. Estado por umbral

- Formato → **Status icons (Pro)** → encender. Icono con forma **y** color: ● bueno, ▲ regular, ◆ malo.
- Regla: sobre ΔPL% (o, sin Plan / AA, sobre el Δ% del periodo). Por defecto bueno ≥ 0 %, malo < −5 %; cambia los dos
  umbrales y comprueba 3-4 filas a mano. *A decrease is good* invierte el sentido.
- *Position*: columna propia o junto al valor (la cifra no debe cortarse).
- Tooltip de fila: "Estado: ◆ Malo · ΔPL%: bueno desde 0,0 %, malo por debajo de −5,0 %".
- Alto contraste: solo la forma distingue el estado (todo en primer plano) y la barra negativa va rayada.

## 3. Hasta 3 columnas de minigráfico

- Formato → **Sparkline 2 (Pro)** y **Sparkline 3 (Pro)**: medida (el desplegable enseña los nombres reales de Values),
  tipo, curva, escala (común por nivel / por fila) y color.
- Ejemplo: 2 = `Margen bruto %` en columnas por fila; 3 = `Ventas netas` en win/loss.
- Cabeceras "Columnas · Margen bruto %" con el rango y "Escala: por fila" si toca. Tooltip sobre cualquiera de las tres:
  el mes bajo el ratón.
- Al estrechar el visual desaparecen primero la 3.ª y la 2.ª; la 1.ª nunca.

## 4. Seis estilos

- Formato → Style template: Boardroom, Ledger, Editorial, Signal, Aurora, Terrace (Pro). Mismos tokens que Line Chart
  y KPI Card: pon un Line Chart en Boardroom al lado y deben casar fondo, texto, plan y verde/rojo.
- Fondo, fuente (Ledger y Editorial en Georgia), varianza, estado y bandas del bullet con los colores del estilo.
- Con `_testfree`: editando, el estilo con marca "estilos de la colección"; en lectura, Report theme.
- Report theme y Classic siguen gratis.

## 5. Formato condicional (fx)

- Formato → Values → *Value color* y *Value background*, y Sparkline → *Color*: botón **fx** → Reglas o Degradado
  sobre `Ventas netas` (o sobre `Margen bruto %`).
- **Comprobar (no verificado fuera de Desktop):** que la regla llega por fila y se pinta en el valor / fondo / línea de
  cada fila, también en subtotales y en el total. El visual lee la regla en la celda de la cifra a la vista (último mes
  o total del rango) y, si no está ahí, en el nodo de la fila. Si en Desktop no se pinta nada, apúntalo: el patrón de
  selectores por nodo de matriz habría que replantearlo.
- Color fijo (sin fx): gratis; tras cerrar el panel y reabrir, el panel lo recuerda (altConstantValueSelector null).
- *Restablecer valores predeterminados* de la tarjeta borra las reglas.
- Con `_testfree`: con una regla puesta, editando sale "formato condicional" en la marca; en lectura se ignora la regla.

## 6. Imagen por fila

- Mismo gating que lo demás: con `_testfree`, en lectura no hay imagen **ni hueco**; editando, la marca dice "imágenes
  de fila" junto a las otras funciones que se pidan.

## 7. Horizon

- Formato → Sparkline → Type → **Horizon** (también en Sparkline 2 / 3). Bandas 2 o 3 (*Horizon bands*), alrededor de
  cero, de la media de la fila o del objetivo (*Horizon baseline*).
- Escala por fila siempre (la cabecera lo dice). Azul por encima de la base, rojo por debajo (o los colores del estilo);
  cuanto más oscuro, más lejos.
- Tooltip de fila: "Horizon: n bandas por signo alrededor de …; más oscuro = más lejos de la base".
- Con `_testfree`: en lectura, el horizon cae a línea; editando, marca "minigráfico de horizonte".

## 8. Gratis: botones de nivel 1 · 2 · 3 (sustituyen a ⊞ / ⊟)

- En la cabecera de la jerarquía, un botón por nivel (como los niveles de agrupación de Excel). Se marca el que se ve.
- **3** (el último) = expandir todo; **2** = provincias abiertas y comerciales cerrados; **1** = contraer TODO.
- Prueba clave: expande todo con **3**, pulsa **1**, y abre una provincia con ▸: sus comerciales deben salir
  **contraídos** (antes salían como estaban). El visual contrae de abajo arriba (primero el nivel de comerciales,
  mientras sigue cargado, luego provincias), un paso por update del host: verás 2 repintados seguidos.
- Desde todo contraído, **2** debe dejar las provincias abiertas y los comerciales cerrados.
- **Límite (inferido, comprobar):** si un nivel no tiene ningún nodo cargado (p. ej. todas las provincias ya estaban
  contraídas), el visual no puede tocarlo; si el host guardaba comerciales abiertos ahí, se quedan. Lo normal es que
  `toggleExpandCollapse(id, true)` aplique al nivel entero, también a lo no cargado: apunta si no es así.
- Marcador: pulsa **2**, crea un marcador, pulsa **3**, aplica el marcador → vuelve al estado del 2.
- Alt + clic en ▸ (un nivel entero) y el menú contextual de Power BI siguen igual. Analizador: cada paso = un par de
  eventos; nada más.

## 9. Gratis: bullet con escala por fila

- Rows: provincia sola (4 filas), Type = Bullet, Target = Plan ventas netas.
- Cada fila se compara con **su** objetivo: Girona (276K frente a 262K) tiene la barra pasando la marca del objetivo
  igual que Barcelona (1,54M frente a 1,53M), aunque sea seis veces más pequeña. El eje de cada fila va de 0 a
  max(valor, objetivo, banda alta) × 1,1 y las bandas son % de su objetivo.
- Etiqueta de la derecha: "1,54M€ · 101 %". Sparkline → *Bullet label*: Value / % of target / both.
- Cabecera: "Bullet · Ventas netas" y "sep 2026 · vs Plan ventas netas · % del objetivo · Escala: por fila".
- Tooltip: valor, objetivo, % del objetivo y banda.

## 10. Gratis: líneas de cuadrícula y sitio de los botones de nivel

- Formato → **Gridlines**. *Vertical lines*: Off / **Between groups** (por defecto, muy suaves: el color de las reglas
  del tema) / Between all columns. Grupos: nombre | cifras (valor, Δ, Δ%) | referencias, varianza y estado | otras
  medidas | minigráficos. Color, grosor 1-3 px y estilo (sólido, discontinuo, punteado).
- *Horizontal lines* (la línea bajo cada fila): on/off, color y grosor 1-3 px.
- Las verticales van centradas en el hueco de *Column spacing*: los anchos de columna no cambian (comprueba que con y sin
  líneas las cifras no se mueven). Cruzan cabecera, filas y total. En alto contraste, color de primer plano.
- Scroll en el escenario B con *Between all columns*: igual de fluido (las líneas son CSS por columna, sin trabajo por
  fila).
- Botones 1 · 2 · 3: a la izquierda del título de la jerarquía, nunca encima. Con la columna estrecha, el título se
  recorta con "…" y los botones se ven enteros.

## 11. Formato en el lienzo (on-object) — fallo del 1.0.0.50

Qué estaba mal: el `HtmlSubSelectionHelper` escucha el clic en el elemento del visual (por burbujeo) y los manejadores
de clic de filas y cabeceras hacían `stopPropagation()` antes de mirar el modo formato, así que el clic nunca llegaba al
helper. Además, las filas que crea el scroll no se marcaban y los estilos de texto iban incompletos.

En Desktop, botón **Formatear** del visual (modo formato en el lienzo), clic en cada elemento: debe recuadrarse, salir
su barra de formato y, con "Más opciones" / doble clic, abrir **su** tarjeta:

| Elemento | Tarjeta |
|---|---|
| Cabecera de columnas y buscador | Column headers |
| Nombre de fila de nivel 1 / 2 / 3 (e imagen) | Row levels (elige el nivel en el selector; el atajo "Rows" lleva a Rows) |
| Fila Total (nombre) | Row levels → Grand total row |
| Valor, Δ, Δ%, otras medidas | Values |
| Plan / AA / FC, ΔPL, barra, ΔPL% | Variance |
| Icono de estado | Status icons |
| Minigráfico 1 / 2 / 3 | Sparkline / Sparkline 2 / Sparkline 3 |
| Bandas del bullet | Qualitative bands |
| Fondo de la tabla (fuera de una celda) | Gridlines |

- En modo formato el clic **no** selecciona datos ni expande/contrae, y el teclado no navega. Sal del modo formato:
  todo vuelve a funcionar igual (clic selecciona, ▸ expande).
- Haz scroll en modo formato y pulsa una fila que no se veía antes: también debe recuadrarse.
- Analizador de rendimiento: un par de eventos por update, también al entrar y salir del modo formato.
- Limitación: el atajo de Row levels abre la tarjeta, pero no preselecciona el nivel en el selector (la API de
  navegación solo admite tarjeta y grupo).

## 12. Gratis: plan repetido, periodo (Blank) y etiqueta de un dato antiguo (Desktop, 12-11)

**Plan repetido en niveles inferiores.** En la demo el plan solo existe por provincia, y el motor lo repite en cada
comercial y en cada PDV (1.531.584 € en todos), con ΔPL% de −90 % que no significan nada.
- Rows → *Repeated references*: **Hide** (por defecto) / Show. Con Hide, el visual detecta el nivel en el que la
  referencia ya no está definida y desde ahí pinta "—" en gris, sin ΔPL, sin barra, sin ΔPL% ni estado contra ella.
  La cabecera de nombres dice "Plan ventas netas: disponible hasta provincia". Provincias y total no cambian (son los
  del motor).
- Regla (honesta, por nivel y no por fila): en un nivel de hijos, la referencia se da por no definida si en TODOS los
  nodos padre con ≥ 2 hijos cada hijo trae exactamente la misma serie que el padre en todos los periodos con dato, y hay
  ≥ 2 padres así o ≥ 3 puntos iguales. Un empate casual en una fila no lo dispara.
- Comprobar: expande Barcelona y un comercial; los comerciales y PDV deben salir con "—". Con un plan que sí baja a
  comercial, nada cambia.
- Causa y receta (también para la FAQ de `support.html`): la medida de plan no tiene detalle por debajo de provincia y
  Power BI repite su valor en cada fila hija. Para que solo aparezca donde corresponde:

```DAX
Plan ventas netas (hasta provincia) =
IF ( ISINSCOPE ( dim_pdv[id_comercial] ) || ISINSCOPE ( dim_pdv[id_pdv] ), BLANK (), [Plan ventas netas] )
```

**Periodo (Blank).** Las filas sin fecha de la demo traían un periodo vacío y la cabecera decía "(Blank) – Sep 2026".
- El periodo vacío sale del eje de minigráficos, del rango de la cabecera, del "último periodo" y del Δ.
- Editando, aviso "n valores sin fecha en el eje no se dibujan".
- *Value shows the total of the range*: el total es el del motor y SÍ incluye esos valores; la cabecera lo dice
  ("Total (incl. sin fecha)"). No se resta nada.

**Etiqueta final de un dato antiguo.** PDV-00189, -00196, -00232 sin dato en sep 2026: la columna de valor sale vacía y
la etiqueta del minigráfico dice ahora su mes y va atenuada ("1,22K€ · jun 2026"). El punto se dibuja en su mes real.
Igual en las columnas de minigráfico 2 y 3 y en horizon.

## 13. Gratis: escala de los minigráficos, explícita

- Sparkline → *Scale* (y Sparkline 2 / 3, cada una con el suyo): **Shared by level** / **Per row in detail** (por
  defecto: por fila en el último nivel, común por nivel en los subtotales) / **Per row** (por fila en TODOS los niveles:
  provincias, comerciales, PDV y total). La cabecera lo rotula siempre ("Escala: común por nivel" / "por fila en el
  detalle" / "por fila"). No hay ningún ajuste por nivel que lo pise (Row levels no tiene escala).
- En el simulador, con *Per row*, cada fila de cada nivel usa su propio mínimo y máximo. Si en Desktop una fila de
  comercial se ve "plana" con *Per row*, mira dos cosas que SÍ cambian la escala de esa fila:
  1. **Columnas y área empiezan en cero** (o *Start at zero* en la línea): una serie de 40-50K se ve casi llena y sin
     relieve. Es a propósito (una barra que no sale de cero exagera). Para ver el relieve, tipo Line sin Start at zero.
  2. **El objetivo entra en la escala de la fila.** Si `Target` es un plan que solo existe por provincia, el motor lo
     repetía en cada comercial y PDV (1,53M) y aplastaba la serie. Ahora se detecta como el plan repetido: en esos
     niveles el objetivo ni se dibuja ni entra en la escala, y la cabecera dice "Objetivo: disponible hasta provincia".
- Horizon y bullet con objetivo: por fila siempre (la cabecera lo dice).

## Rendimiento y certificación (repetir con todo puesto)

- Analizador de rendimiento: un par de eventos por update; el scroll no emite nada.
- Escenario A todo expandido con Plan, AA, estado y 3 minigráficos: anota el tiempo de carga y de un update.
- Marcadores con 2 niveles expandidos y una fila seleccionada (como en el bloque 1).
