/**
 * Tabla del panel de formato. Generado por tools/formato.py: no editar a mano.
 * Los nombres internos (objeto.propiedad) no se renombran nunca: los informes guardados dejarían de leerlos.
 */
export type PropType = "bool" | "num" | "fill" | "enum" | "text" | "font";
export interface PropSpec { name: string; type: PropType; def: string | number | boolean; key: string; label: string;
    items?: [string, string, string][]; min?: number; max?: number; }
export interface ObjSpec { name: string; key: string; label: string; props: PropSpec[]; }
export interface GroupSpec { obj: string; toggle: string | null; key?: string; label?: string; }
export interface CardSpec { uid: string; key: string; label: string; groups: GroupSpec[]; }
export const OBJECTS: Record<string, ObjSpec> = {
    "style": {
        "name": "style",
        "key": "Obj_style",
        "label": "Style template",
        "props": [
            {
                "name": "template",
                "type": "enum",
                "def": "report",
                "key": "Prop_style_template",
                "label": "Template",
                "items": [
                    [
                        "report",
                        "Enum_template_report",
                        "Report theme"
                    ],
                    [
                        "classic",
                        "Enum_template_classic",
                        "Classic"
                    ]
                ]
            },
            {
                "name": "guide",
                "type": "bool",
                "def": true,
                "key": "Prop_style_guide",
                "label": "Setup guide"
            }
        ]
    },
    "values": {
        "name": "values",
        "key": "Obj_values",
        "label": "Values",
        "props": [
            {
                "name": "compare",
                "type": "enum",
                "def": "previous",
                "key": "Prop_values_compare",
                "label": "Change vs",
                "items": [
                    [
                        "previous",
                        "Enum_compare_previous",
                        "Previous period"
                    ],
                    [
                        "lastYear",
                        "Enum_compare_lastYear",
                        "Same period last year"
                    ]
                ]
            },
            {
                "name": "showDelta",
                "type": "bool",
                "def": true,
                "key": "Prop_values_showDelta",
                "label": "Show change (Δ)"
            },
            {
                "name": "showDeltaPct",
                "type": "bool",
                "def": true,
                "key": "Prop_values_showDeltaPct",
                "label": "Show change % (Δ%)"
            },
            {
                "name": "invert",
                "type": "bool",
                "def": false,
                "key": "Prop_values_invert",
                "label": "A decrease is good"
            },
            {
                "name": "upColor",
                "type": "fill",
                "def": "",
                "key": "Prop_values_upColor",
                "label": "Increase color"
            },
            {
                "name": "downColor",
                "type": "fill",
                "def": "",
                "key": "Prop_values_downColor",
                "label": "Decrease color"
            },
            {
                "name": "smallBase",
                "type": "num",
                "def": 10,
                "key": "Prop_values_smallBase",
                "label": "Dim Δ% on small bases (% of level median)",
                "min": 0,
                "max": 100
            },
            {
                "name": "fontSize",
                "type": "num",
                "def": 11,
                "key": "Prop_values_fontSize",
                "label": "Text size",
                "min": 8,
                "max": 18
            }
        ]
    },
    "sparkline": {
        "name": "sparkline",
        "key": "Obj_sparkline",
        "label": "Sparkline",
        "props": [
            {
                "name": "type",
                "type": "enum",
                "def": "line",
                "key": "Prop_sparkline_type",
                "label": "Type",
                "items": [
                    [
                        "line",
                        "Enum_type_line",
                        "Line"
                    ],
                    [
                        "area",
                        "Enum_type_area",
                        "Area"
                    ],
                    [
                        "column",
                        "Enum_type_column",
                        "Column"
                    ],
                    [
                        "winloss",
                        "Enum_type_winloss",
                        "Win/loss"
                    ],
                    [
                        "bullet",
                        "Enum_type_bullet",
                        "Bullet"
                    ]
                ]
            },
            {
                "name": "scale",
                "type": "enum",
                "def": "auto",
                "key": "Prop_sparkline_scale",
                "label": "Scale",
                "items": [
                    [
                        "auto",
                        "Enum_scale_auto",
                        "Per row in detail rows, shared in subtotals"
                    ],
                    [
                        "level",
                        "Enum_scale_level",
                        "Shared by level"
                    ],
                    [
                        "row",
                        "Enum_scale_row",
                        "Per row"
                    ]
                ]
            },
            {
                "name": "zero",
                "type": "bool",
                "def": false,
                "key": "Prop_sparkline_zero",
                "label": "Start at zero"
            },
            {
                "name": "curve",
                "type": "enum",
                "def": "linear",
                "key": "Prop_sparkline_curve",
                "label": "Curve",
                "items": [
                    [
                        "linear",
                        "Enum_curve_linear",
                        "Linear"
                    ],
                    [
                        "smooth",
                        "Enum_curve_smooth",
                        "Smooth"
                    ],
                    [
                        "step",
                        "Enum_curve_step",
                        "Step"
                    ]
                ]
            },
            {
                "name": "lineColor",
                "type": "enum",
                "def": "neutral",
                "key": "Prop_sparkline_lineColor",
                "label": "Line colour",
                "items": [
                    [
                        "neutral",
                        "Enum_lineColor_neutral",
                        "Neutral"
                    ],
                    [
                        "row",
                        "Enum_lineColor_row",
                        "Per row"
                    ],
                    [
                        "trend",
                        "Enum_lineColor_trend",
                        "By trend"
                    ]
                ]
            },
            {
                "name": "width",
                "type": "num",
                "def": 1.5,
                "key": "Prop_sparkline_width",
                "label": "Line width",
                "min": 0.5,
                "max": 4
            },
            {
                "name": "color",
                "type": "fill",
                "def": "",
                "key": "Prop_sparkline_color",
                "label": "Color"
            },
            {
                "name": "accent",
                "type": "fill",
                "def": "",
                "key": "Prop_sparkline_accent",
                "label": "Last point color"
            },
            {
                "name": "showLast",
                "type": "bool",
                "def": true,
                "key": "Prop_sparkline_showLast",
                "label": "Show last value"
            },
            {
                "name": "target",
                "type": "bool",
                "def": true,
                "key": "Prop_sparkline_target",
                "label": "Show target line"
            },
            {
                "name": "targetColor",
                "type": "fill",
                "def": "",
                "key": "Prop_sparkline_targetColor",
                "label": "Target color"
            }
        ]
    },
    "bands": {
        "name": "bands",
        "key": "Obj_bands",
        "label": "Qualitative bands",
        "props": [
            {
                "name": "showBands",
                "type": "bool",
                "def": true,
                "key": "Prop_bands_showBands",
                "label": "Show bands"
            },
            {
                "name": "band1Pct",
                "type": "num",
                "def": 80,
                "key": "Prop_bands_band1Pct",
                "label": "Poor below (% of target)",
                "min": 0,
                "max": 200
            },
            {
                "name": "band2Pct",
                "type": "num",
                "def": 95,
                "key": "Prop_bands_band2Pct",
                "label": "Good from (% of target)",
                "min": 0,
                "max": 200
            },
            {
                "name": "lowerIsBetter",
                "type": "bool",
                "def": false,
                "key": "Prop_bands_lowerIsBetter",
                "label": "Lower is better"
            },
            {
                "name": "band1Color",
                "type": "fill",
                "def": "#F6CFCB",
                "key": "Prop_bands_band1Color",
                "label": "Band 1 (worst)"
            },
            {
                "name": "band2Color",
                "type": "fill",
                "def": "#FBE7B5",
                "key": "Prop_bands_band2Color",
                "label": "Band 2 (mid)"
            },
            {
                "name": "band3Color",
                "type": "fill",
                "def": "#CDE8CF",
                "key": "Prop_bands_band3Color",
                "label": "Band 3 (best)"
            }
        ]
    },
    "markers": {
        "name": "markers",
        "key": "Obj_markers",
        "label": "Markers",
        "props": [
            {
                "name": "last",
                "type": "bool",
                "def": true,
                "key": "Prop_markers_last",
                "label": "Last point"
            },
            {
                "name": "first",
                "type": "bool",
                "def": false,
                "key": "Prop_markers_first",
                "label": "First point"
            },
            {
                "name": "max",
                "type": "bool",
                "def": false,
                "key": "Prop_markers_max",
                "label": "Maximum"
            },
            {
                "name": "min",
                "type": "bool",
                "def": false,
                "key": "Prop_markers_min",
                "label": "Minimum"
            },
            {
                "name": "negative",
                "type": "bool",
                "def": false,
                "key": "Prop_markers_negative",
                "label": "Negative points"
            },
            {
                "name": "size",
                "type": "num",
                "def": 2.5,
                "key": "Prop_markers_size",
                "label": "Marker size",
                "min": 1,
                "max": 5
            }
        ]
    },
    "rows": {
        "name": "rows",
        "key": "Obj_rows",
        "label": "Rows",
        "props": [
            {
                "name": "density",
                "type": "enum",
                "def": "standard",
                "key": "Prop_rows_density",
                "label": "Density",
                "items": [
                    [
                        "compact",
                        "Enum_density_compact",
                        "Compact"
                    ],
                    [
                        "standard",
                        "Enum_density_standard",
                        "Standard"
                    ],
                    [
                        "comfortable",
                        "Enum_density_comfortable",
                        "Comfortable"
                    ]
                ]
            },
            {
                "name": "fontSize",
                "type": "num",
                "def": 11,
                "key": "Prop_rows_fontSize",
                "label": "Text size",
                "min": 8,
                "max": 18
            },
            {
                "name": "rowHeight",
                "type": "num",
                "def": 0,
                "key": "Prop_rows_rowHeight",
                "label": "Row height (px, 0 = automatic)",
                "min": 0,
                "max": 48
            },
            {
                "name": "indent",
                "type": "num",
                "def": 14,
                "key": "Prop_rows_indent",
                "label": "Indent per level",
                "min": 0,
                "max": 40
            },
            {
                "name": "colSpacing",
                "type": "num",
                "def": 16,
                "key": "Prop_rows_colSpacing",
                "label": "Column spacing (px)",
                "min": 12,
                "max": 40
            },
            {
                "name": "imageGap",
                "type": "bool",
                "def": true,
                "key": "Prop_rows_imageGap",
                "label": "Reserve space for row images"
            },
            {
                "name": "grandTotal",
                "type": "bool",
                "def": true,
                "key": "Prop_rows_grandTotal",
                "label": "Grand total"
            },
            {
                "name": "tooltips",
                "type": "enum",
                "def": "sparkline",
                "key": "Prop_rows_tooltips",
                "label": "Tooltips",
                "items": [
                    [
                        "sparkline",
                        "Enum_tooltips_sparkline",
                        "Sparkline only"
                    ],
                    [
                        "row",
                        "Enum_tooltips_row",
                        "Whole row"
                    ],
                    [
                        "off",
                        "Enum_tooltips_off",
                        "Off"
                    ]
                ]
            },
            {
                "name": "sortBy",
                "type": "enum",
                "def": "host",
                "key": "Prop_rows_sortBy",
                "label": "Sort by",
                "items": [
                    [
                        "host",
                        "Enum_sortBy_host",
                        "Power BI order"
                    ],
                    [
                        "name",
                        "Enum_sortBy_name",
                        "Name"
                    ],
                    [
                        "value",
                        "Enum_sortBy_value",
                        "Value"
                    ],
                    [
                        "value2",
                        "Enum_sortBy_value2",
                        "Value 2"
                    ],
                    [
                        "value3",
                        "Enum_sortBy_value3",
                        "Value 3"
                    ],
                    [
                        "delta",
                        "Enum_sortBy_delta",
                        "Change (Δ)"
                    ],
                    [
                        "deltaPct",
                        "Enum_sortBy_deltaPct",
                        "Change % (Δ%)"
                    ]
                ]
            },
            {
                "name": "sortDir",
                "type": "enum",
                "def": "desc",
                "key": "Prop_rows_sortDir",
                "label": "Sort direction",
                "items": [
                    [
                        "desc",
                        "Enum_sortDir_desc",
                        "Descending"
                    ],
                    [
                        "asc",
                        "Enum_sortDir_asc",
                        "Ascending"
                    ]
                ]
            }
        ]
    },
    "header": {
        "name": "header",
        "key": "Obj_header",
        "label": "Column headers",
        "props": [
            {
                "name": "show",
                "type": "bool",
                "def": true,
                "key": "Prop_header_show",
                "label": "Show column headers"
            },
            {
                "name": "fontSize",
                "type": "num",
                "def": 11,
                "key": "Prop_header_fontSize",
                "label": "Text size",
                "min": 8,
                "max": 18
            },
            {
                "name": "fontFamily",
                "type": "font",
                "def": "",
                "key": "Prop_header_fontFamily",
                "label": "Font"
            },
            {
                "name": "bold",
                "type": "bool",
                "def": true,
                "key": "Prop_header_bold",
                "label": "Bold"
            },
            {
                "name": "color",
                "type": "fill",
                "def": "",
                "key": "Prop_header_color",
                "label": "Text color"
            },
            {
                "name": "background",
                "type": "fill",
                "def": "",
                "key": "Prop_header_background",
                "label": "Background"
            },
            {
                "name": "context",
                "type": "bool",
                "def": true,
                "key": "Prop_header_context",
                "label": "Show period line"
            }
        ]
    },
    "level1": {
        "name": "level1",
        "key": "Obj_level1",
        "label": "Level 1",
        "props": [
            {
                "name": "background",
                "type": "fill",
                "def": "",
                "key": "Prop_level1_background",
                "label": "Background"
            },
            {
                "name": "bgOpacity",
                "type": "num",
                "def": 100,
                "key": "Prop_level1_bgOpacity",
                "label": "Background opacity (%)",
                "min": 0,
                "max": 100
            },
            {
                "name": "color",
                "type": "fill",
                "def": "",
                "key": "Prop_level1_color",
                "label": "Text color"
            },
            {
                "name": "fontSize",
                "type": "num",
                "def": 0,
                "key": "Prop_level1_fontSize",
                "label": "Text size (0 = as Rows)",
                "min": 0,
                "max": 24
            },
            {
                "name": "fontFamily",
                "type": "font",
                "def": "",
                "key": "Prop_level1_fontFamily",
                "label": "Font"
            },
            {
                "name": "bold",
                "type": "enum",
                "def": "auto",
                "key": "Prop_level1_bold",
                "label": "Bold",
                "items": [
                    [
                        "auto",
                        "Enum_bold_auto",
                        "Automatic"
                    ],
                    [
                        "on",
                        "Enum_bold_on",
                        "On"
                    ],
                    [
                        "off",
                        "Enum_bold_off",
                        "Off"
                    ]
                ]
            },
            {
                "name": "italic",
                "type": "bool",
                "def": false,
                "key": "Prop_level1_italic",
                "label": "Italic"
            },
            {
                "name": "image",
                "type": "bool",
                "def": true,
                "key": "Prop_level1_image",
                "label": "Show row image (Pro)"
            },
            {
                "name": "imageSize",
                "type": "num",
                "def": 0,
                "key": "Prop_level1_imageSize",
                "label": "Image size (px, 0 = automatic)",
                "min": 0,
                "max": 48
            },
            {
                "name": "imageShape",
                "type": "enum",
                "def": "square",
                "key": "Prop_level1_imageShape",
                "label": "Image shape",
                "items": [
                    [
                        "square",
                        "Enum_imageShape_square",
                        "Square"
                    ],
                    [
                        "round",
                        "Enum_imageShape_round",
                        "Round"
                    ]
                ]
            }
        ]
    },
    "level2": {
        "name": "level2",
        "key": "Obj_level2",
        "label": "Level 2",
        "props": [
            {
                "name": "background",
                "type": "fill",
                "def": "",
                "key": "Prop_level2_background",
                "label": "Background"
            },
            {
                "name": "bgOpacity",
                "type": "num",
                "def": 100,
                "key": "Prop_level2_bgOpacity",
                "label": "Background opacity (%)",
                "min": 0,
                "max": 100
            },
            {
                "name": "color",
                "type": "fill",
                "def": "",
                "key": "Prop_level2_color",
                "label": "Text color"
            },
            {
                "name": "fontSize",
                "type": "num",
                "def": 0,
                "key": "Prop_level2_fontSize",
                "label": "Text size (0 = as Rows)",
                "min": 0,
                "max": 24
            },
            {
                "name": "fontFamily",
                "type": "font",
                "def": "",
                "key": "Prop_level2_fontFamily",
                "label": "Font"
            },
            {
                "name": "bold",
                "type": "enum",
                "def": "auto",
                "key": "Prop_level2_bold",
                "label": "Bold",
                "items": [
                    [
                        "auto",
                        "Enum_bold_auto",
                        "Automatic"
                    ],
                    [
                        "on",
                        "Enum_bold_on",
                        "On"
                    ],
                    [
                        "off",
                        "Enum_bold_off",
                        "Off"
                    ]
                ]
            },
            {
                "name": "italic",
                "type": "bool",
                "def": false,
                "key": "Prop_level2_italic",
                "label": "Italic"
            },
            {
                "name": "image",
                "type": "bool",
                "def": true,
                "key": "Prop_level2_image",
                "label": "Show row image (Pro)"
            },
            {
                "name": "imageSize",
                "type": "num",
                "def": 0,
                "key": "Prop_level2_imageSize",
                "label": "Image size (px, 0 = automatic)",
                "min": 0,
                "max": 48
            },
            {
                "name": "imageShape",
                "type": "enum",
                "def": "square",
                "key": "Prop_level2_imageShape",
                "label": "Image shape",
                "items": [
                    [
                        "square",
                        "Enum_imageShape_square",
                        "Square"
                    ],
                    [
                        "round",
                        "Enum_imageShape_round",
                        "Round"
                    ]
                ]
            }
        ]
    },
    "level3": {
        "name": "level3",
        "key": "Obj_level3",
        "label": "Level 3",
        "props": [
            {
                "name": "background",
                "type": "fill",
                "def": "",
                "key": "Prop_level3_background",
                "label": "Background"
            },
            {
                "name": "bgOpacity",
                "type": "num",
                "def": 100,
                "key": "Prop_level3_bgOpacity",
                "label": "Background opacity (%)",
                "min": 0,
                "max": 100
            },
            {
                "name": "color",
                "type": "fill",
                "def": "",
                "key": "Prop_level3_color",
                "label": "Text color"
            },
            {
                "name": "fontSize",
                "type": "num",
                "def": 0,
                "key": "Prop_level3_fontSize",
                "label": "Text size (0 = as Rows)",
                "min": 0,
                "max": 24
            },
            {
                "name": "fontFamily",
                "type": "font",
                "def": "",
                "key": "Prop_level3_fontFamily",
                "label": "Font"
            },
            {
                "name": "bold",
                "type": "enum",
                "def": "auto",
                "key": "Prop_level3_bold",
                "label": "Bold",
                "items": [
                    [
                        "auto",
                        "Enum_bold_auto",
                        "Automatic"
                    ],
                    [
                        "on",
                        "Enum_bold_on",
                        "On"
                    ],
                    [
                        "off",
                        "Enum_bold_off",
                        "Off"
                    ]
                ]
            },
            {
                "name": "italic",
                "type": "bool",
                "def": false,
                "key": "Prop_level3_italic",
                "label": "Italic"
            },
            {
                "name": "image",
                "type": "bool",
                "def": true,
                "key": "Prop_level3_image",
                "label": "Show row image (Pro)"
            },
            {
                "name": "imageSize",
                "type": "num",
                "def": 0,
                "key": "Prop_level3_imageSize",
                "label": "Image size (px, 0 = automatic)",
                "min": 0,
                "max": 48
            },
            {
                "name": "imageShape",
                "type": "enum",
                "def": "square",
                "key": "Prop_level3_imageShape",
                "label": "Image shape",
                "items": [
                    [
                        "square",
                        "Enum_imageShape_square",
                        "Square"
                    ],
                    [
                        "round",
                        "Enum_imageShape_round",
                        "Round"
                    ]
                ]
            }
        ]
    },
    "levelTotal": {
        "name": "levelTotal",
        "key": "Obj_levelTotal",
        "label": "Grand total row",
        "props": [
            {
                "name": "background",
                "type": "fill",
                "def": "",
                "key": "Prop_levelTotal_background",
                "label": "Background"
            },
            {
                "name": "bgOpacity",
                "type": "num",
                "def": 100,
                "key": "Prop_levelTotal_bgOpacity",
                "label": "Background opacity (%)",
                "min": 0,
                "max": 100
            },
            {
                "name": "color",
                "type": "fill",
                "def": "",
                "key": "Prop_levelTotal_color",
                "label": "Text color"
            },
            {
                "name": "fontSize",
                "type": "num",
                "def": 0,
                "key": "Prop_levelTotal_fontSize",
                "label": "Text size (0 = as Rows)",
                "min": 0,
                "max": 24
            },
            {
                "name": "fontFamily",
                "type": "font",
                "def": "",
                "key": "Prop_levelTotal_fontFamily",
                "label": "Font"
            },
            {
                "name": "bold",
                "type": "enum",
                "def": "auto",
                "key": "Prop_levelTotal_bold",
                "label": "Bold",
                "items": [
                    [
                        "auto",
                        "Enum_bold_auto",
                        "Automatic"
                    ],
                    [
                        "on",
                        "Enum_bold_on",
                        "On"
                    ],
                    [
                        "off",
                        "Enum_bold_off",
                        "Off"
                    ]
                ]
            },
            {
                "name": "italic",
                "type": "bool",
                "def": false,
                "key": "Prop_levelTotal_italic",
                "label": "Italic"
            },
            {
                "name": "image",
                "type": "bool",
                "def": true,
                "key": "Prop_levelTotal_image",
                "label": "Show row image (Pro)"
            },
            {
                "name": "imageSize",
                "type": "num",
                "def": 0,
                "key": "Prop_levelTotal_imageSize",
                "label": "Image size (px, 0 = automatic)",
                "min": 0,
                "max": 48
            },
            {
                "name": "imageShape",
                "type": "enum",
                "def": "square",
                "key": "Prop_levelTotal_imageShape",
                "label": "Image shape",
                "items": [
                    [
                        "square",
                        "Enum_imageShape_square",
                        "Square"
                    ],
                    [
                        "round",
                        "Enum_imageShape_round",
                        "Round"
                    ]
                ]
            }
        ]
    }
};
export const PANE: CardSpec[] = [
    {
        "uid": "style",
        "key": "Obj_style",
        "label": "Style template",
        "groups": [
            {
                "obj": "style",
                "toggle": null
            }
        ]
    },
    {
        "uid": "values",
        "key": "Obj_values",
        "label": "Values",
        "groups": [
            {
                "obj": "values",
                "toggle": null
            }
        ]
    },
    {
        "uid": "sparkline",
        "key": "Obj_sparkline",
        "label": "Sparkline",
        "groups": [
            {
                "obj": "sparkline",
                "toggle": null
            }
        ]
    },
    {
        "uid": "bands",
        "key": "Obj_bands",
        "label": "Qualitative bands",
        "groups": [
            {
                "obj": "bands",
                "toggle": "showBands"
            }
        ]
    },
    {
        "uid": "markers",
        "key": "Obj_markers",
        "label": "Markers",
        "groups": [
            {
                "obj": "markers",
                "toggle": null
            }
        ]
    },
    {
        "uid": "rows",
        "key": "Obj_rows",
        "label": "Rows",
        "groups": [
            {
                "obj": "rows",
                "toggle": null
            }
        ]
    },
    {
        "uid": "levels",
        "key": "Obj_levels",
        "label": "Row levels",
        "groups": []
    },
    {
        "uid": "header",
        "key": "Obj_header",
        "label": "Column headers",
        "groups": [
            {
                "obj": "header",
                "toggle": "show"
            }
        ]
    }
];
