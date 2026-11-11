/**
 * Tabla del panel de formato. Generado por tools/formato.py: no editar a mano.
 * Los nombres internos (objeto.propiedad) no se renombran nunca: los informes guardados dejarían de leerlos.
 */
export type PropType = "bool" | "num" | "fill" | "enum" | "text";
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
                "name": "valueMode",
                "type": "enum",
                "def": "last",
                "key": "Prop_values_valueMode",
                "label": "Value shows",
                "items": [
                    [
                        "last",
                        "Enum_valueMode_last",
                        "Last period"
                    ],
                    [
                        "total",
                        "Enum_valueMode_total",
                        "Total of the range"
                    ]
                ]
            },
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
                "def": "level",
                "key": "Prop_sparkline_scale",
                "label": "Scale",
                "items": [
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
                "name": "indent",
                "type": "num",
                "def": 14,
                "key": "Prop_rows_indent",
                "label": "Indent per level",
                "min": 0,
                "max": 40
            },
            {
                "name": "grandTotal",
                "type": "bool",
                "def": true,
                "key": "Prop_rows_grandTotal",
                "label": "Grand total"
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
                "name": "context",
                "type": "bool",
                "def": true,
                "key": "Prop_header_context",
                "label": "Show period line"
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
