import frappe
from itertools import groupby

login_required = True

# Section display config: section name -> (emoji, css theme class)
SECTION_META = {
    "Sales":                   ("📋", "ts"),
    "Service":                 ("🔧", "tv"),
    "Vehicle & Fleet":         ("🚛", "tg"),
    "Training & LCS Academy":  ("🎓", "tt"),
    "HR & Personnel":          ("👤", "th"),
    "Admin & Compliance":      ("⚙️", "ta"),
}

# Canonical display order for sections
SECTION_ORDER = list(SECTION_META.keys())


def get_context(context):
    if frappe.session.user == "Guest":
        frappe.throw("Not permitted", frappe.PermissionError)

    context.no_cache = 1

    # --- Employee info ---
    employee = frappe.db.get_value(
        "Employee",
        {"user_id": frappe.session.user, "status": "Active"},
        ["employee_name", "designation", "department"],
        as_dict=True,
    )
    if employee:
        context.employee_name = employee.employee_name
        context.designation   = employee.designation or ""
        context.department    = employee.department or ""
    else:
        context.employee_name = (
            frappe.db.get_value("User", frappe.session.user, "full_name")
            or frappe.session.user
        )
        context.designation = ""
        context.department  = ""

    # --- Shortcuts from DocType (enabled only, ordered) ---
    rows = frappe.get_all(
        "LCS Shortcut",
        filters={"enabled": 1},
        fields=["label", "section", "url", "description", "icon", "badge", "sort_order"],
        order_by="section asc, sort_order asc, label asc",
    )

    # Group by section, preserving canonical order
    by_section = {k: list(v) for k, v in groupby(rows, key=lambda r: r["section"])}

    sections = []
    for sec_name in SECTION_ORDER:
        cards = by_section.get(sec_name, [])
        if not cards:
            continue
        icon, theme = SECTION_META.get(sec_name, ("📌", "ta"))
        sections.append({
            "name":  sec_name,
            "icon":  icon,
            "theme": theme,
            "cards": cards,
        })

    # Any section in the DB that isn't in SECTION_ORDER goes last
    for sec_name, cards in by_section.items():
        if sec_name not in SECTION_META:
            sections.append({
                "name":  sec_name,
                "icon":  "📌",
                "theme": "ta",
                "cards": list(cards),
            })

    context.sections = sections