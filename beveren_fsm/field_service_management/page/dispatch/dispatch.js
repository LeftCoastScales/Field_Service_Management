// beveren_fsm/field_service_management/page/dispatch/dispatch.js

frappe.pages['dispatch'].on_page_load = function (wrapper) {
    frappe.ui.make_app_page({
        parent: wrapper,
        single_column: true
    });

    $(wrapper).html(frappe.render_template("dispatch"));

    new DispatchController();
};

class DispatchController {
    constructor() {
        this.sidebarMode = "Service Order"; // default
        this.sidebarCollapsed = false;
        this.currentView = "gantt";  // default
        this.cachedDocs = [];

        this.setup_navbar_buttons();
        this.setup_sidebar_header_events();

        // Load Service Orders in sidebar on first load
        this.loadSidebarItems("Service Order");

        // Show Gantt by default
        this.switchView("gantt");
    }

    // NAVBAR
    setup_navbar_buttons() {
        $("#sidebar-toggle-btn").on("click", () => {
            this.toggleSidebar();
        });
        $("#btn-gantt").on("click", () => {
            this.switchView("gantt");
        });
        $("#btn-calendar").on("click", () => {
            this.switchView("calendar");
        });
        $("#btn-map").on("click", () => {
            this.switchView("map");
        });
    }

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        const $sidebar = $("#dispatch-sidebar");
        if (this.sidebarCollapsed) {
            $sidebar.addClass("collapsed");
            $("#sidebar-toggle-btn i")
                .removeClass("fa-angle-double-left")
                .addClass("fa-angle-double-right");
        } else {
            $sidebar.removeClass("collapsed");
            $("#sidebar-toggle-btn i")
                .removeClass("fa-angle-double-right")
                .addClass("fa-angle-double-left");
        }
    }

    switchView(view) {
        $(".nav-view-btn").removeClass("active");
        $(`#btn-${view}`).addClass("active");
        this.currentView = view;

        if (view === "gantt") {
            this.show_gantt_view();
        } else if (view === "calendar") {
            this.show_calendar_view();
        } else if (view === "map") {
            this.show_map_view();
        }
    }

    show_gantt_view() {
        $("#view-content").empty();
        const ganttContainer = $(`
            <div class="gantt-view">
                <div id="gantt-page-body"></div>
            </div>
        `);
        $("#view-content").append(ganttContainer);
        init_gantt_code("#gantt-page-body");
    }

    show_calendar_view() {
        // Clear the #view-content area
        $("#view-content").empty();

        // Create a container for the calendar
        const calendarContainer = $(`
            <div class="calendar-view">
                <div id="calendar-page-body"></div>
            </div>
        `);
        $("#view-content").append(calendarContainer);

        // Now call our init function that sets up the Calendar
        init_calendar_code("#calendar-page-body");
    }

    show_map_view() {
        $("#view-content").html(`
            <div class="view-placeholder map-placeholder">
                <h3>Map View</h3>
                <p>Map UI goes here.</p>
            </div>
        `);
    }

    // SIDEBAR
    setup_sidebar_header_events() {
        // Dropdown toggle
        $("#sidebar-dropdown-toggle").on("click", () => {
            $("#sidebar-dropdown").toggleClass("open");
        });

        // The Add icon is always shown now
        $("#sidebar-add-icon").on("click", () => {
            if (this.sidebarMode === "Service Order") {
                this.open_create_schedule_dialog();
            } else {
                // Service Appointment
                this.open_create_schedule_dialog();
            }
        });

        // Search toggle
        $("#sidebar-search-toggle").on("click", () => {
            $("#sidebar-inline-search").toggleClass("visible");
            if ($("#sidebar-inline-search").hasClass("visible")) {
                $("#sidebar-search-input").focus();
            }
        });

        // Refresh
        $("#sidebar-refresh").on("click", () => {
            frappe.msgprint("Refreshing sidebar data...");
            this.loadSidebarItems(this.sidebarMode, true);
        });

        // Dropdown tabs
        $(".dropdown-tab").on("click", (e) => {
            let mode = $(e.currentTarget).data("mode");
            this.switchSidebarMode(mode);

            $(".dropdown-tab").removeClass("active");
            $(e.currentTarget).addClass("active");
        });

        // Inline search
        $("#sidebar-search-input").on("keyup", () => {
            let val = $("#sidebar-search-input").val().toLowerCase();
            this.filterSidebarDocs(val);
        });
    }

    switchSidebarMode(mode) {
        this.sidebarMode = mode;
        $("#sidebar-selected-mode").text(mode);
        $("#sidebar-dropdown").removeClass("open");
        this.loadSidebarItems(mode, true);

        let placeholderText = (mode === "Service Order")
            ? "Search Service Orders..."
            : "Search Service Appointments...";
        $("#sidebar-search-input").attr("placeholder", placeholderText);
    }

    loadSidebarItems(mode, forceRefresh=false) {
        let $sidebarList = $("#sidebar-list");
        $sidebarList.empty();

        frappe.call({
            method: "beveren_fsm.field_service_management.page.dispatch.dispatch.get_sidebar_data",
            args: { mode },
            callback: (r) => {
                if (!r.exc) {
                    this.cachedDocs = r.message || [];
                    this.renderSidebarDocs(this.cachedDocs, mode);
                }
            }
        });
    }

    renderSidebarDocs(docs, mode) {
        let $sidebarList = $("#sidebar-list");
        $sidebarList.empty();

        docs.forEach(doc => {
            let pillHtml = this.getPillHtml(doc, mode);
            let moreInfoHtml = this.getMoreInfoHtml(doc, mode);

            let li = $(`
                <li class="sidebar-doc-item" 
                    data-doc='${JSON.stringify(doc)}'
                    data-mode="${mode}">
                    <a href="#">
                        <strong>${doc.name}</strong><br>
                        ${moreInfoHtml}
                        ${pillHtml}
                    </a>
                </li>
            `);
            $sidebarList.append(li);
        });

        this.setupSidebarRightClick();
    }

    filterSidebarDocs(searchVal) {
        let filtered = this.cachedDocs.filter(doc => {
            let docStr = JSON.stringify(doc).toLowerCase();
            return docStr.includes(searchVal);
        });
        this.renderSidebarDocs(filtered, this.sidebarMode);
    }

    setupSidebarRightClick() {
        $(document).off("click.sidebarTooltip").on("click.sidebarTooltip", () => {
            $("#sidebar-tooltip").hide();
        });

        $(".sidebar-doc-item").off("contextmenu").on("contextmenu", (e) => {
            e.preventDefault();
            let $li = $(e.currentTarget);
            let docStr = $li.attr("data-doc");
            let doc = JSON.parse(docStr || "{}");
            let mode = $li.attr("data-mode");
            this.showSidebarTooltip(e.pageX, e.pageY, doc, mode);
        });
    }

    // Pill
    getPillHtml(doc, mode) {
        if (mode === "Service Order") {
            let priority = (doc.priority || "").toLowerCase();
            let color = "#6c757d";
            if (priority === "high") color = "#dc3545";
            if (priority === "medium") color = "#ffc107";
            if (priority === "low") color = "#28a745";
            return `<span class="pill" style="background-color: ${color}; border-radius: 12px; font-size: 0.75rem;">${doc.priority || ""}</span>`;
        } else {
            let status = (doc.status || "").toLowerCase();
            let color = "#6c757d";
            if (status === "scheduled") color = "#007bff";
            if (status === "in progress") color = "#ffc107";
            if (status === "completed") color = "#28a745";
            if (status === "cancelled") color = "#dc3545";
            if (status === "dispatched") color = "#17a2b8";
            return `<span class="pill" style="background-color: ${color}; border-radius: 12px; font-size: 0.75rem;">${doc.status || ""}</span>`;
        }
    }

    getMoreInfoHtml(doc, mode) {
        if (mode === "Service Order") {
            let date = doc.transaction_date || "";
            let customer = doc.customer || "";
            return `<span class="small-text" style="font-size: 0.8rem;">${date} - ${customer}</span><br>`;
        } else {
            let date = doc.posting_date || "";
            let start = doc.scheduled_start_datetime ? doc.scheduled_start_datetime.split(" ")[1] : "";
            let end   = doc.scheduled_finish_datetime ? doc.scheduled_finish_datetime.split(" ")[1] : "";
            return `<span class="small-text" style="font-size: 0.8rem;">${date} - ${start} to ${end}</span><br>`;
        }
    }

    showSidebarTooltip(x, y, doc, mode) {
        let tooltip = $("#sidebar-tooltip");
        tooltip.empty().show();

        let itemsIcon = `<i class="fa fa-list"></i>`;
        let techsIcon = `<i class="fa fa-users"></i>`;
        let addIcon   = `<i class="fa fa-plus"></i>`;

        let itemsBtn = `<button class="btn btn-sm btn-secondary" data-action="view-items" title="View Items">${itemsIcon}</button>`;
        let techsBtn = (mode === "Service Appointment")
            ? `<button class="btn btn-sm btn-info" data-action="view-techs" title="View Technicians">${techsIcon}</button>`
            : ``;

        // For the Add icon in the tooltip:
        let addBtn = ``;
        if (mode === "Service Order") {
            // If doc.status != "Completed"
            if ((doc.status || "").toLowerCase() !== "completed") {
                addBtn = `<button class="btn btn-sm btn-success" data-action="add-item" title="Add">${addIcon}</button>`;
            }
        } else {
            // Appointment => always show add => e.g. confirm invoice
            addBtn = `<button class="btn btn-sm btn-primary" data-action="add-item" title="Create Invoice">${addIcon}</button>`;
        }

        let headerHtml = `
            <div class="tooltip-header">
                <strong>${doc.name}</strong>
                <div class="tooltip-buttons">
                    ${itemsBtn}
                    ${techsBtn}
                    ${addBtn}
                </div>
            </div>
        `;

        let bodyHtml = `<div class="tooltip-body">`;
        if (mode === "Service Order") {
            bodyHtml += `
                <p><strong>Customer:</strong> ${doc.customer || "N/A"}</p>
                <p><strong>Date:</strong> ${doc.transaction_date || ""}</p>
                <p><strong>Status:</strong> ${doc.status || ""}</p>
                <p><strong>Priority:</strong> ${doc.priority || ""}</p>
            `;
        } else {
            bodyHtml += `
                <p><strong>Posting Date:</strong> ${doc.posting_date || ""}</p>
                <p><strong>Status:</strong> ${doc.status || ""}</p>
                <p><strong>Start:</strong> ${doc.scheduled_start_datetime || ""}</p>
                <p><strong>Finish:</strong> ${doc.scheduled_finish_datetime || ""}</p>
            `;
        }
        bodyHtml += `</div>`;

        tooltip.html(headerHtml + bodyHtml);

        // Position near (x, y)
        let tooltipWidth = tooltip.outerWidth();
        let tooltipHeight = tooltip.outerHeight();
        let finalX = x + 10; 
        let finalY = y;
        if (finalX + tooltipWidth > $(window).width()) {
            finalX = x - tooltipWidth - 10;
        }
        if (finalY + tooltipHeight > $(window).height()) {
            finalY = $(window).height() - tooltipHeight - 20;
        }
        tooltip.css({ left: finalX + "px", top: finalY + "px" });

        // Button handlers
        tooltip.find("[data-action='view-items']").on("click", () => {
            this.showItemsDialog(doc, mode);
        });
        if (mode === "Service Appointment") {
            tooltip.find("[data-action='view-techs']").on("click", () => {
                this.showTechniciansDialog(doc);
            });
        }
        tooltip.find("[data-action='add-item']").on("click", () => {
            if (mode === "Service Order") {
                // create event for order
                this.create_event_for_order(doc);
            } else {
                // Appointment => confirm invoice
                frappe.confirm(
                    "Create an invoice for this appointment?",
                    () => {
                        frappe.msgprint("Proceed with invoice creation...");
                    }
                );
            }
        });
    }

    // Items dialog
    // If doc is not completed (order) or not in progress/completed (appointment),
    // show "Add Item" button
    showItemsDialog(doc) {
        let dialog = new frappe.ui.Dialog({
            title: "Service Items",
            fields: [
				{
					fieldname: "service_items",
					fieldtype: "Table",
					label: __("Service Items"),
					in_place_edit: true,
					reqd: 1,
					fields: [
						{
							fieldname: "item_code",
							label: __("Item"),
							fieldtype: "Link",
							options: "Item",
							reqd: 1,
							in_list_view: 1,
						},
						
						{
							fieldname: "qty",
							label: __("Qty"),
							fieldtype: "Data",
							reqd: 1,
							in_list_view: 1,
						},
						{
							fieldname: "invoice_status",
							label: __("Invoice Status"),
							fieldtype: "Data",
							reqd: 1,
							in_list_view: 1,
						}
					]
				}
			],
            primary_action_label: "Close",
            primary_action: () => dialog.hide()
        });
        
		let tableField = dialog.get_field("service_items");
		tableField.df.data = doc.items;
		tableField.grid.refresh();

		dialog.show();

    }

    // Technicians dialog
    //TODOD: If doc.status not in progress or completed => "Add Technician"
    showTechniciansDialog(doc) {
		console.log(doc);
		
        let dialog = new frappe.ui.Dialog({
            title: "Technicians",
            fields: [
				{
					fieldname: "service_technicians",
					fieldtype: "Table",
					label: __("Service Technicians"),
					options: "Service Technician Item",
					in_place_edit: true,
					reqd: 1,
					fields: [
						{
							fieldname: "service_technician",
							label: __("Item"),
							fieldtype: "Link",
							options: "Item",
							reqd: 1,
							in_list_view: 1,
						},
						
						{
							fieldname: "full_name",
							label: __("Full Name"),
							fieldtype: "Data",
							fetch_from: "service_technician.full_name",
							reqd: 1,
							in_list_view: 1,
						},
					
					]
				}
			],
            primary_action_label: "Close",
            primary_action: () => dialog.hide()
        });
        
		let tableField = dialog.get_field("service_technicians");
		tableField.df.data = doc.service_technicians;
		tableField.grid.refresh();

		dialog.show();
    }

    // If user clicks the Add icon in the sidebar or tooltip for orders
    create_event_for_order(orderDoc = null) {
        if (!orderDoc) {
            frappe.prompt(
                [
                    { fieldname: "service_order", label: "Service Order", fieldtype: "Link", options: "Service Order", reqd: 1 }
                ],
                (values) => {
                    this.open_create_schedule_dialog(values.service_order);
                },
                "Create Schedule",
                "Create"
            );
        } else {
            this.open_create_schedule_dialog(orderDoc.name);
        }
    }

    open_create_schedule_dialog(OrderName = "") {
        let selectedDate = frappe.datetime.get_today();
        let d = new frappe.ui.Dialog({
            title: "Create Schedule",
            fields: [
                { fieldname: 'service_order', fieldtype: 'Link', options: 'Service Order', label: 'Service Order', default: OrderName, reqd: 1 },
                { fieldtype: 'Column Break' },
                { fieldname: 'selected_date', fieldtype: 'Date', label: 'Selected Date', default: selectedDate },
                { fieldname: 'start_time', fieldtype: 'Time', label: 'Start Time', default: "09:00" },
                { fieldname: 'finish_time', fieldtype: 'Time', label: 'Finish Time', default: "10:00" }
            ],
            primary_action_label: "Schedule & Dispatch",
            primary_action: (values) => {
                let scheduledStart = values.selected_date + " " + values.start_time;
                let scheduledFinish = values.selected_date + " " + values.finish_time;
                create_appointment(
                    values.selected_date,
                    values.service_order,
                    scheduledStart,
                    scheduledFinish,
                    "TECH-0001",
                    (r) => {
                        frappe.msgprint("Appointment created for " + values.service_order);
                    }
                );
                d.hide();
            }
        });
        d.show();
    }
}

/* 
   This function contains ALL your old Gantt logic from service_scheduling.js, 
   except the old on_page_load. We embed it here so that when we call 
   init_gantt_code("#gantt-page-body"), it sets up everything in that container.
*/
function init_gantt_code(containerSelector) {

    // ---------------------------
    // OLD GANTT CODE BEGINS HERE
    // (We’ve only changed references to the Python methods and 
    // removed the old frappe.pages[...] on_page_load.)
    // ---------------------------

    // Global constants and variables
    const START_TIME_MINUTES    = 420;   // 07:00 in minutes
    const END_TIME_MINUTES      = 1140;  // 19:00 in minutes
    const TOTAL_WORKING_MINUTES = END_TIME_MINUTES - START_TIME_MINUTES;

    var status_colors = {
        "Scheduled": "#007bff",
        "Rescheduled": "#28a745",
        "Completed": "#6c757d",
        "Cancelled": "#dc3545"
    };

    let isResizing = false;
    let justResized = false;
    let currentSelectedDate = frappe.datetime.get_today();

    // Mobile detection
    function isMobile() {
        return window.innerWidth < 768;
    }

    function generate_date_range(selected_date) {
        let dates = [];
        if (isMobile()) {
            // Show 5 days: 2 before, current, 2 after
            for (let i = -2; i <= 2; i++) {
                dates.push(frappe.datetime.add_days(selected_date, i));
            }
        } else {
            // Default range: from -10 to +9 days (20 days total)
            let today_index = 9;
            for (let i = -today_index; i <= (19 - today_index - 1); i++) {
                dates.push(frappe.datetime.add_days(selected_date, i));
            }
        }
        return dates;
    }

    function openDatePicker() {
        let d = new frappe.ui.Dialog({
            title: "Select Date",
            fields: [
                { fieldname: "selected_date", fieldtype: "Date", label: "Date", default: currentSelectedDate }
            ],
            primary_action_label: "Go",
            primary_action: (values) => {
                currentSelectedDate = values.selected_date;
                load_schedule(values.selected_date);
                d.hide();
            }
        });
        d.show();
    }

    // Helper functions
    const timeStringToMinutes = (timeStr) => {
        const parts = timeStr.split(":");
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    const minutesToTimeString = (minutes) => {
        const hrs = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return ("0" + hrs).slice(-2) + ":" + ("0" + mins).slice(-2);
    };

    const roundToNearestTen = (mins) => Math.round(mins / 10) * 10;

    const formatDatetime = (date, timeStr) => {
        const parts = timeStr.split(":");
        if (parts.length === 2) {
            return date + " " + timeStr + ":00";
        }
        return date + " " + timeStr;
    };

    const calculatePosition = (startMins, endMins) => {
        const leftPercent = ((startMins - START_TIME_MINUTES) / TOTAL_WORKING_MINUTES) * 100;
        const widthPercent = ((endMins - startMins) / TOTAL_WORKING_MINUTES) * 100;
        return { leftPercent, widthPercent };
    };

    const debounce = (func, delay) => {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // Transform a service order number
    function transformServiceOrder(order) {
        if (!order) return "";
        let parts = order.split("-");
        if (parts.length >= 1) {
            return "ORD-" + parts[parts.length - 1];
        }
        return order;
    }

    // Drag & Drop
    function drag(event) {
        event.dataTransfer.setData("text", event.target.outerHTML);
        event.target.classList.add("dragging");
    }

    function dragEnd(event) {
        event.target.classList.remove("dragging");
    }

    const allowDrop = (event) => {
        event.preventDefault();
    };

    function is_overlapping(technician, startMins, endMins) {
        let overlapping = false;
        $(`.technician-row[data-tech='${technician}'] .schedule-event`).each(function () {
            const eventStart = timeStringToMinutes($(this).attr("data-start"));
            const eventEnd = timeStringToMinutes($(this).attr("data-end"));
            if (startMins < eventEnd && endMins > eventStart) {
                overlapping = true;
                return false;
            }
        });
        return overlapping;
    }

    function is_overlapping_excluding(technician, startMins, endMins, excludeId) {
        let overlapping = false;
        $(`.technician-row[data-tech='${technician}'] .schedule-event`).each(function () {
            if ($(this).data("appointment") == excludeId) return;
            const eventStart = timeStringToMinutes($(this).attr("data-start"));
            const eventEnd = timeStringToMinutes($(this).attr("data-end"));
            if (startMins < eventEnd && endMins > eventStart) {
                overlapping = true;
                return false;
            }
        });
        return overlapping;
    }

    // Container for the entire Gantt UI
    const pageBody = $(`
        <div>
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h3 id="month-header"></h3>
                <div>
                    <button class="btn btn-sm btn-secondary mr-2" id="select-date-btn"><i class="fa fa-calendar"></i></button>
                    <button class="btn btn-sm btn-primary mr-2" id="today-btn">Today</button>
                    <button class="btn btn-sm btn-secondary mr-2" id="tomorrow-btn">Tomorrow</button>
                </div>
            </div>
            <div id="month-row" class="text-center font-weight-bold mb-1"></div>
            <div id="date-table"></div>
            <div id="schedule-grid" ${isMobile() ? 'style="overflow-x:auto;"' : ''}></div>
        </div>
    `);

    // Append the Gantt UI structure to containerSelector
    $(containerSelector).append(pageBody);

    // Event resizing
    function startResizing(e, eventElement, side) {
        e.stopPropagation();
        isResizing = true;
        $(eventElement).attr("draggable", false);
        const initialX = e.pageX;
        const initialStart = timeStringToMinutes($(eventElement).data("start"));
        const initialEnd = timeStringToMinutes($(eventElement).data("end"));

        const onMouseMove = (e) => {
            const delta = e.pageX - initialX;
            const timelineWidth = $(eventElement).parent().width();
            const deltaMins = (delta / timelineWidth) * TOTAL_WORKING_MINUTES;
            if (side === "left") {
                let newStart = initialStart + deltaMins;
                if (newStart < START_TIME_MINUTES) newStart = START_TIME_MINUTES;
                if (newStart >= initialEnd - 30) newStart = initialEnd - 30;
                $(eventElement).attr("data-start", minutesToTimeString(newStart));
                const pos = calculatePosition(newStart, initialEnd);
                $(eventElement).css({ left: pos.leftPercent + '%', width: pos.widthPercent + '%' });
            } else if (side === "right") {
                let newEnd = initialEnd + deltaMins;
                if (newEnd > END_TIME_MINUTES) newEnd = END_TIME_MINUTES;
                if (newEnd <= initialStart + 30) newEnd = initialStart + 30;
                $(eventElement).attr("data-end", minutesToTimeString(newEnd));
                const pos = calculatePosition(initialStart, newEnd);
                $(eventElement).css({ width: pos.widthPercent + '%' });
            }
        };

        const onMouseUp = (e) => {
            $(document).off("mousemove", onMouseMove);
            $(document).off("mouseup", onMouseUp);
            $(eventElement).attr("draggable", true);
            isResizing = false;
            justResized = true;
            setTimeout(() => { justResized = false; }, 300);

            const newStartStr = $(eventElement).attr("data-start");
            const newEndStr = $(eventElement).attr("data-end");
            if (!newStartStr || !newEndStr) {
                frappe.msgprint("Error reading time data after resizing.");
                return;
            }
            const newStart = timeStringToMinutes(newStartStr);
            const newEnd = timeStringToMinutes(newEndStr);
            const technician = $(eventElement).data("tech");
            const appointmentId = $(eventElement).data("appointment");
            if (is_overlapping_excluding(technician, newStart, newEnd, appointmentId)) {
                frappe.msgprint("Time overlap detected during resizing. Reverting changes.");
                $(eventElement).attr("data-start", minutesToTimeString(initialStart));
                $(eventElement).attr("data-end", minutesToTimeString(initialEnd));
                const pos = calculatePosition(initialStart, initialEnd);
                $(eventElement).css({ left: pos.leftPercent + '%', width: pos.widthPercent + '%' });
                return;
            }
            update_appointment(
                appointmentId,
                currentSelectedDate,
                $(eventElement).data("service-order"),
                formatDatetime(currentSelectedDate, minutesToTimeString(newStart)),
                formatDatetime(currentSelectedDate, minutesToTimeString(newEnd)),
                $(eventElement).data("tech")
            );
        };

        $(document).on("mousemove", onMouseMove);
        $(document).on("mouseup", onMouseUp);
    }

    function attachResizeHandles(eventElement) {
        if ($(eventElement).find(".resize-handle").length === 0) {
            $(eventElement).append('<div class="resize-handle left-handle"></div>');
            $(eventElement).append('<div class="resize-handle right-handle"></div>');
        }
        $(eventElement).find(".left-handle").on("mousedown", (e) => {
            startResizing(e, eventElement, "left");
        });
        $(eventElement).find(".right-handle").on("mousedown", (e) => {
            startResizing(e, eventElement, "right");
        });
    }

    // Create event
    function create_event(event, timelineCell) {
        if ($(event.target).hasClass("schedule-event") || isResizing || justResized) return;
        const technician = $(timelineCell).closest(".technician-row").data("tech");
        const timelineOffset = $(timelineCell).offset();
        const clickX = event.pageX - timelineOffset.left;
        const timelineWidth = $(timelineCell).width();
        let minutesFromStart = (clickX / timelineWidth) * TOTAL_WORKING_MINUTES;
        minutesFromStart = roundToNearestTen(minutesFromStart);
        const eventStartMinutes = START_TIME_MINUTES + minutesFromStart;
        const eventEndMinutes = eventStartMinutes + 30;
        const selectedDate = currentSelectedDate || frappe.datetime.get_today();

        let d = new frappe.ui.Dialog({
            title: "Create Schedule",
            fields: [
                { fieldname: 'appointment', fieldtype: 'Link', options: 'Service Appointment', label: 'Appointment', read_only: 1, default: "", hidden: 1 },
                { fieldname: 'service_order', fieldtype: 'Link', options: 'Service Order', label: 'Service Order', reqd: 1 },
                { fieldname: 'technician', fieldtype: 'Link', options: 'Service Technician', label: 'Technician', read_only: 1, default: technician },
                { fieldtype: 'Column Break' },
                { fieldname: 'selected_date', fieldtype: 'Date', label: 'Selected Date', default: selectedDate, read_only: 1 },
                { fieldname: 'start_time', fieldtype: 'Time', label: 'Start Time', default: minutesToTimeString(eventStartMinutes), reqd: 1 },
                { fieldname: 'finish_time', fieldtype: 'Time', label: 'Finish Time', default: minutesToTimeString(eventEndMinutes), reqd: 1 }
            ],
            primary_action_label: "Schedule & Dispatch",
            primary_action: (values) => {
                const startMins = timeStringToMinutes(values.start_time);
                const endMins = timeStringToMinutes(values.finish_time);
                if (startMins >= endMins || startMins < START_TIME_MINUTES || endMins > END_TIME_MINUTES) {
                    frappe.msgprint("Invalid time range. Select a valid start and finish time between 07:00 - 19:00.");
                    return;
                }
                if ((endMins - startMins) < 30) {
                    frappe.msgprint("Time range must be at least 30 minutes.");
                    return;
                }
                if (is_overlapping(technician, startMins, endMins)) {
                    frappe.msgprint("Time overlap detected! Please select a different time.");
                    return;
                }
                const scheduledStartDatetime = formatDatetime(values.selected_date, values.start_time);
                const scheduledFinishDatetime = formatDatetime(values.selected_date, values.finish_time);
                create_appointment(
                    values.selected_date,
                    values.service_order,
                    scheduledStartDatetime,
                    scheduledFinishDatetime,
                    technician,
                    (appointment_data) => {
                        const appointment_id = appointment_data.name;
                        const appointment_status = appointment_data.status || "Dispatched";
                        const event_color = appointment_data.color || status_colors[appointment_status] || "#007bff";
                        const duration = endMins - startMins;
                        const pos = calculatePosition(startMins, endMins);
                        const $eventEl = $(`
                            <div class="schedule-event" draggable="true" ondragstart="drag(event)" ondragend="dragEnd(event)" onclick="edit_event(this)"
                                data-appointment="${appointment_id}" data-tech="${technician}" data-start="${values.start_time}" data-end="${values.finish_time}"
                                data-service-order="${values.service_order}" data-status="${appointment_status}" data-color="${appointment_data.color}">
                                ${transformServiceOrder(values.service_order)} (${values.start_time} - ${values.finish_time})
                            </div>
                        `);
                        $eventEl.css({
                            background: event_color,
                            left: pos.leftPercent + '%',
                            width: pos.widthPercent + '%'
                        });
                        $(timelineCell).append($eventEl);
                        attachResizeHandles($eventEl);
                        d.set_value('appointment', appointment_id);
                        d.hide();
                    }
                );
            }
        });
        d.show();
    }

    // Render schedule grid
    function render_schedule_grid(technicians, selected_date, appointments) {
        const gridContainer = $(`
            <div class="schedule-grid-container" style="position: relative; width: 100%;"></div>
        `);

        // Create a merged header row
        const headerRow = $(`
            <div class="technician-row header-row" style="display: flex; height: 40px; border-bottom: 1px solid #ddd;">
                <div class="technician-name" style="width: 20%; background: #f0f0f0; text-align: center; line-height: 40px; border-right: 1px solid #ddd; font-size: ${isMobile() ? "10px" : "12px"};">
                    <input type="text" id="technician-search" class="form-control form-control-sm" placeholder="Search Technician" style="height: 100%; border: none; outline: none; box-shadow: none; border-radius: 0;"/>
                </div>
                <div class="timeline-cell" style="width: 80%; position: relative;"></div>
            </div>
        `);

        // Insert bold time labels inside the timeline-cell
        for (let m = 0; m < TOTAL_WORKING_MINUTES; m += 60) {
            const rawTime = minutesToTimeString(START_TIME_MINUTES + m);
            const displayTime = isMobile() ? parseInt(rawTime.split(":")[0]) : rawTime;
            const leftPercent = (m / TOTAL_WORKING_MINUTES) * 100;
            const labelDiv = $(`
                <div class="time-label" style="position: absolute; left: ${leftPercent}%; transform: translateX(-50%); font-size: ${isMobile() ? "10px" : "12px"}; color: #555; font-weight: bold;">
                    ${displayTime}
                </div>
            `);
            headerRow.find(".timeline-cell").append(labelDiv);
        }
        gridContainer.append(headerRow);

        // Separator line
        const separator = $(`
            <div class="separator" style="width: 100%; border-top: 1px solid #ddd; margin: 0; padding: 0;"></div>
        `);
        gridContainer.append(separator);

        // Technician rows
        const techRowsContainer = $(`<div class="technician-rows"></div>`);
        technicians.forEach(tech => {
            const techRow = $(`
                <div class="technician-row" data-tech="${tech.service_technician}" style="display: flex; height: 33px; border-bottom: 1px solid #ddd;">
                    <div class="technician-name" style="width: 20%; background: #f0f0f0; text-align: center; line-height: 33px; border-right: 1px solid #ddd; font-size: ${isMobile() ? "10px" : "12px"}; ${isMobile() ? "white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" : ""}">
                        ${tech.full_name}
                    </div>
                    <div class="timeline-cell" style="width: 80%; position: relative;" onclick="create_event(event, this)" ondrop="drop(event, this)" ondragover="allowDrop(event)"></div>
                </div>
            `);
            techRowsContainer.append(techRow);
        });
        gridContainer.append(techRowsContainer);

        $('#schedule-grid').html(gridContainer);

        // Timeline background
        const timelineBackground = $(`
            <div class="timeline-background" style="position: absolute; left: 20%; top: 15px; width: 80%; bottom: 0; pointer-events: none;"></div>
        `);
        for (let m = 0; m <= TOTAL_WORKING_MINUTES; m += 10) {
            const leftPercent = (m / TOTAL_WORKING_MINUTES) * 100;
            const lineWidth = (m % 60 === 0) ? 2 : 1;
            const lineColor = (m % 60 === 0) ? "#aaa" : "#ddd";
            const lineDiv = $(`
                <div style="position: absolute; top: 0; bottom: 0; left: ${leftPercent}%; width: ${lineWidth}px; background: ${lineColor};"></div>
            `);
            timelineBackground.append(lineDiv);
        }
        gridContainer.append(timelineBackground);

        // Filter technician rows
        $("#technician-search").off("keyup").on("keyup", debounce(function () {
            const value = $(this).val().toLowerCase();
            $(".technician-row").not(".header-row").filter(function () {
                $(this).toggle($(this).text().toLowerCase().includes(value));
            });
        }, 300));

        // Populate appointments
        appointments.forEach(appointment => {
            appointment.service_technicians.forEach(technicianName => {
                technicianName = technicianName.trim();
                const $techRow = $(`.technician-row[data-tech='${technicianName}']`);
                if ($techRow.length === 0) return;
                const timelineCell = $techRow.find(".timeline-cell");
                const startMins = timeStringToMinutes(appointment.start_time);
                const endMins = timeStringToMinutes(appointment.finish_time);
                const pos = calculatePosition(startMins, endMins);
                const appointment_status = appointment.status || "Dispatched";
                const event_color = appointment.color || status_colors[appointment_status] || "#007bff";
                const $ev = $(`
                    <div class="schedule-event" draggable="true" ondragstart="drag(event)" ondragend="dragEnd(event)" onclick="edit_event(this)"
                        data-appointment="${appointment.name}" data-tech="${technicianName}" data-start="${appointment.start_time}"
                        data-end="${appointment.finish_time}" data-service-order="${appointment.service_order}" data-status="${appointment_status}" data-color="${appointment.color}">
                        ${transformServiceOrder(appointment.service_order)} (${appointment.start_time} - ${appointment.finish_time})
                    </div>
                `);
                $ev.css({
                    background: event_color,
                    left: pos.leftPercent + '%',
                    width: pos.widthPercent + '%'
                });
                timelineCell.append($ev);
                attachResizeHandles($ev);
            });
        });
    }

    // Edit event
    window.edit_event = function(eventElement) {
        if (justResized) return;
        const appointmentId = $(eventElement).data("appointment");
        const service_order = $(eventElement).data("service-order");
        const start_time = $(eventElement).attr("data-start");
        const finish_time = $(eventElement).attr("data-end");
        const technician = $(eventElement).data("tech");
        const selectedDate = currentSelectedDate || frappe.datetime.get_today();

        let d = new frappe.ui.Dialog({
            title: "Edit Schedule",
            fields: [
                { fieldname: 'appointment', fieldtype: 'Link', options: 'Service Appointment', label: 'Appointment', default: appointmentId, read_only: 1 },
                { fieldname: 'service_order', fieldtype: 'Link', options: 'Service Order', label: 'Service Order', default: service_order, read_only: 1 },
                { fieldname: 'technician', fieldtype: 'Link', options: 'Service Technician', label: 'Technician', default: technician, read_only: 1 },
                { fieldtype: 'Column Break' },
                { fieldname: 'selected_date', fieldtype: 'Date', label: 'Selected Date', default: selectedDate, read_only: 1 },
                { fieldname: 'start_time', fieldtype: 'Time', label: 'Start Time', default: start_time, reqd: 1 },
                { fieldname: 'finish_time', fieldtype: 'Time', label: 'Finish Time', default: finish_time, reqd: 1 }
            ],
            primary_action_label: "Update",
            primary_action: (values) => {
                const newStart = timeStringToMinutes(values.start_time);
                const newEnd = timeStringToMinutes(values.finish_time);
                if (newStart >= newEnd || newStart < START_TIME_MINUTES || newEnd > END_TIME_MINUTES) {
                    frappe.msgprint("Invalid time range. Select a valid start and finish time between 07:00 - 19:00.");
                    return;
                }
                if ((newEnd - newStart) < 30) {
                    frappe.msgprint("Time range must be at least 30 minutes.");
                    return;
                }
                const pos = calculatePosition(newStart, newEnd);
                $(eventElement).css({
                    left: pos.leftPercent + '%',
                    width: pos.widthPercent + '%'
                });
                $(eventElement).attr("data-start", values.start_time);
                $(eventElement).attr("data-end", values.finish_time);
                $(eventElement).html(`${transformServiceOrder(values.service_order)} (${values.start_time} - ${values.finish_time})`);

                const scheduledStartDatetime = formatDatetime(values.selected_date, values.start_time);
                const scheduledFinishDatetime = formatDatetime(values.selected_date, values.finish_time);
                update_appointment(
                    values.appointment,
                    values.selected_date,
                    values.service_order,
                    scheduledStartDatetime,
                    scheduledFinishDatetime,
                    $(eventElement).data("tech")
                );
                d.hide();
            }
        });
        d.show();
    };

    // Drop
    window.drop = function(event, timelineCell) {
        event.preventDefault();
        const draggedHtml = event.dataTransfer.getData("text");
        const draggedElement = $(draggedHtml);
        const oldStart = timeStringToMinutes(draggedElement.attr("data-start"));
        const oldEnd = timeStringToMinutes(draggedElement.attr("data-end"));
        const duration = oldEnd - oldStart;
        const timelineOffset = $(timelineCell).offset();
        const dropX = event.pageX - timelineOffset.left;
        const timelineWidth = $(timelineCell).width();
        let minutesFromStart = (dropX / timelineWidth) * TOTAL_WORKING_MINUTES;
        minutesFromStart = roundToNearestTen(minutesFromStart);
        let newStartMins = START_TIME_MINUTES + minutesFromStart;
        let newEndMins = newStartMins + duration;
        if (newStartMins < START_TIME_MINUTES) {
            newStartMins = START_TIME_MINUTES;
            newEndMins = newStartMins + duration;
        }
        if (newEndMins > END_TIME_MINUTES) {
            newStartMins = END_TIME_MINUTES - duration;
            newEndMins = END_TIME_MINUTES;
        }
        const technician = $(timelineCell).closest(".technician-row").data("tech");
        if (is_overlapping_excluding(technician, newStartMins, newEndMins, draggedElement.data("appointment"))) {
            frappe.msgprint("Time overlap detected after drop! Please choose a different position.");
            return;
        }
        const serviceOrder = draggedElement.data("service-order");
        if (!serviceOrder) {
            frappe.msgprint("Service Order is required. Please create an event first.");
            return;
        }
        const newStartTime = minutesToTimeString(newStartMins);
        const newEndTime = minutesToTimeString(newEndMins);
        $(`.schedule-event[data-appointment='${draggedElement.data("appointment")}']`).remove();
        const pos = calculatePosition(newStartMins, newEndMins);
        const event_color = draggedElement.data("color") || status_colors[draggedElement.data("status")] || "#007bff";
        const event_html = `
            <div class="schedule-event" draggable="true" ondragstart="drag(event)" ondragend="dragEnd(event)" onclick="edit_event(this)" 
                data-appointment="${draggedElement.data("appointment")}" data-tech="${technician}" data-start="${newStartTime}" data-end="${newEndTime}" 
                data-service-order="${serviceOrder}" data-status="${draggedElement.data("status")}" data-color="${event_color}">
                ${transformServiceOrder(serviceOrder)} (${newStartTime} - ${newEndTime})
            </div>
        `;
        const $newEvent = $(event_html);
        $newEvent.css({
            background: event_color,
            left: pos.leftPercent + '%',
            width: pos.widthPercent + '%'
        });
        $(timelineCell).append($newEvent);
        const selectedDate = currentSelectedDate || frappe.datetime.get_today();
        const scheduledStartDatetime = formatDatetime(selectedDate, newStartTime);
        const scheduledFinishDatetime = formatDatetime(selectedDate, newEndTime);
        update_appointment(
            draggedElement.data("appointment"),
            selectedDate,
            serviceOrder,
            scheduledStartDatetime,
            scheduledFinishDatetime,
            technician
        );
    };

    // Context Menu
    $(document).on('contextmenu', '.schedule-event', function(e) {
        var $this = $(this);
        var status = $this.data("status");
        if (status !== "Dispatched" && status !== "Scheduled") {
            return;
        }
        e.preventDefault();
        $("#custom-context-menu").remove();
        var appointmentId = $this.data("appointment");
        var menuItems = "";
        if (status === "Dispatched") {
            menuItems = `
                <div class="context-menu-item" data-action="start_work" style="padding: 5px 10px; cursor: pointer; border-bottom: 1px solid #eee;">Start Work</div>
                <div class="context-menu-item" data-action="invoice" style="padding: 5px 10px; cursor: pointer;">Invoice</div>
            `;
        } else if (status === "Scheduled") {
            menuItems = `
                <div class="context-menu-item" data-action="reschedule" style="padding: 5px 10px; cursor: pointer; border-bottom: 1px solid #eee;">Reschedule</div>
                <div class="context-menu-item" data-action="invoice" style="padding: 5px 10px; cursor: pointer;">Invoice</div>
            `;
        }
        var menu = $(`
            <div id="custom-context-menu" style="position: absolute; z-index: 10000; background: #fff; border: 1px solid #ccc; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 14px;">
                ${menuItems}
            </div>
        `);
        menu.data("appointmentId", appointmentId);
        menu.data("eventElement", this);
        menu.css({ top: e.pageY + "px", left: e.pageX + "px" });
        $("body").append(menu);
    });

    $(document).on('mouseenter', '#custom-context-menu .context-menu-item', function() {
        $(this).css('background', '#f5f5f5');
    }).on('mouseleave', '#custom-context-menu .context-menu-item', function() {
        $(this).css('background', '#fff');
    });

    $(document).on('click', '.context-menu-item', function(e) {
        e.stopPropagation();
        var action = $(this).data("action");
        var appointmentId = $("#custom-context-menu").data("appointmentId");
        var eventElement = $("#custom-context-menu").data("eventElement");
        $("#custom-context-menu").remove();
        if (action === "start_work") {
            startWork(appointmentId);
        } else if (action === "reschedule") {
            edit_event(eventElement);
        } else if (action === "invoice") {
            invoiceAppointment(appointmentId);
        }
    });

    $(document).on("click", function(e) {
        $("#custom-context-menu").remove();
    });

    // Mobile long-press
    var touchTimer;
    $(document).on('touchstart', '.schedule-event', function(e) {
        var $this = $(this);
        touchTimer = setTimeout(function() {
            var status = $this.data("status");
            if (status !== "Dispatched" && status !== "Scheduled") {
                return;
            }
            $("#custom-context-menu").remove();
            var appointmentId = $this.data("appointment");
            var touch = e.originalEvent.touches[0];
            var menuItems = "";
            if (status === "Dispatched") {
                menuItems = `
                    <div class="context-menu-item" data-action="start_work" style="padding: 5px 10px; cursor: pointer; border-bottom: 1px solid #eee;">Start Work</div>
                    <div class="context-menu-item" data-action="invoice" style="padding: 5px 10px; cursor: pointer;">Invoice</div>
                `;
            } else if (status === "Scheduled") {
                menuItems = `
                    <div class="context-menu-item" data-action="reschedule" style="padding: 5px 10px; cursor: pointer; border-bottom: 1px solid #eee;">Reschedule</div>
                    <div class="context-menu-item" data-action="invoice" style="padding: 5px 10px; cursor: pointer;">Invoice</div>
                `;
            }
            var menu = $(`
                <div id="custom-context-menu" style="position: absolute; z-index: 10000; background: #fff; border: 1px solid #ccc; box-shadow: 2px 2px 5px rgba(0,0,0,0.2); font-family: sans-serif; font-size: 14px;">
                    ${menuItems}
                </div>
            `);
            menu.data("appointmentId", appointmentId);
            menu.data("eventElement", $this.get(0));
            menu.css({ top: touch.pageY + "px", left: touch.pageX + "px" });
            $("body").append(menu);
        }, 800);
    }).on('touchend touchcancel', '.schedule-event', function(e) {
        clearTimeout(touchTimer);
    });

    // Backend actions
    function startWork(appointmentId) {
        frappe.call({
            method: "beveren_fsm.field_service_management.page.dispatch.dispatch.start_work",
            args: { appointment_id: appointmentId },
            callback: function(r) {
                if (!r.exc) {
                    frappe.msgprint("Appointment started");
                    refresh_schedule_grid(currentSelectedDate);
                }
            }
        });
    }

    function invoiceAppointment(appointmentId) {
        frappe.set_route("Form", "Service Appointment", appointmentId);
    }

    // Date table
    function render_date_table(selected_date) {
        const dates = generate_date_range(selected_date);
        let table_html = `<table class="table table-bordered"><thead><tr>`;
        dates.forEach(date => {
            const isSelected = date === selected_date ? 'selected-date' : '';
            const monthName = new Date(date).toLocaleString('en-us', { month: 'short' }).toUpperCase();
            table_html += `<th class="date-header ${isSelected}" data-date="${date}" onclick="filter_by_date('${date}')">
                                <div>${format_date(date)}</div>
                                <div class="small" style="font-size: 8px;">${monthName}</div>
                           </th>`;
        });
        table_html += `</tr></thead></table>`;
        $('#date-table').html(table_html);
    }

    window.filter_by_date = function(date) {
        $('.date-header').removeClass('selected-date');
        $(`.date-header[data-date='${date}']`).addClass('selected-date');
        currentSelectedDate = date;
        load_schedule(date);
    };

    function format_date(date) {
        const dateObj = new Date(date);
        const dayName = dateObj.toLocaleString('en-us', { weekday: 'short' }).toUpperCase();
        const dayNum = dateObj.getDate();
        return `<div>${dayName}</div><div>${dayNum}</div>`;
    }

    function refresh_schedule_grid(selected_date) {
        $('#schedule-grid').html(`
            <div class="text-center" style="padding: 20px;">
                <div class="spinner-border text-muted"></div>
            </div>
        `);
        setTimeout(() => {
            load_schedule(selected_date);
        }, 100);
    }

    function create_appointment(selected_date, service_order, scheduled_start_datetime, scheduled_finish_datetime, technician, callback) {
        frappe.call({
            method: "beveren_fsm.field_service_management.page.dispatch.dispatch.create_service_appointment",
            args: {
                selected_date,
                service_order,
                scheduled_start_datetime,
                scheduled_finish_datetime,
                technician
            },
            callback: (r) => {
                if (!r.exc) {
                    if (callback) {
                        callback(r.message);
                    }
                    refresh_schedule_grid(selected_date);
                } else {
                    frappe.msgprint("Failed to update schedule.");
                }
            }
        });
    }

    function update_appointment(appointment_id, selected_date, service_order, start_time, end_time, technician) {
        frappe.call({
            method: "beveren_fsm.field_service_management.page.dispatch.dispatch.update_service_appointment",
            args: {
                appointment_id,
                selected_date,
                service_order,
                scheduled_start_datetime: start_time,
                scheduled_finish_datetime: end_time,
                technician
            },
            callback: (r) => {
                if (!r.exc) {
                    refresh_schedule_grid(selected_date);
                }
            }
        });
    }

    function load_schedule(selected_date) {
        currentSelectedDate = selected_date;
        frappe.call({
            method: "beveren_fsm.field_service_management.page.dispatch.dispatch.get_schedule_data",
            args: { selected_date, all_dates:false },
            callback: (r) => {
                if (r.message) {
                    render_date_table(selected_date);
                    render_schedule_grid(r.message.technicians, selected_date, r.message.appointments);
                } else if (r.exc) {
                    console.error("Error fetching schedule data", r.exc);
                    frappe.msgprint("An error occurred while loading the schedule.");
                }
            }
        });
    }

    // Initialize default date
    currentSelectedDate = frappe.datetime.get_today();
    load_schedule(currentSelectedDate);

    // Hook up "Today" and "Tomorrow" buttons
    $("#today-btn").on("click", () => {
        const selected_date = frappe.datetime.get_today();
        currentSelectedDate = selected_date;
        load_schedule(selected_date);
    });
    $("#tomorrow-btn").on("click", () => {
        const selected_date = frappe.datetime.add_days(frappe.datetime.get_today(), 1);
        currentSelectedDate = selected_date;
        load_schedule(selected_date);
    });
    $("#select-date-btn").on("click", () => {
        openDatePicker();
    });

}

// ======================================== CALENDAR =======================================
/*
    I write here is our self-contained Calendar logic, similar to init_gantt_code.
    It handles:
    1) Loading FullCalendar assets (if needed).
    2) Building the UI (optionally).
    3) Fetching events from the server.
    4) Rendering the calendar in containerSelector.
*/
function init_calendar_code(containerSelector) {
    frappe.require([
        "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js",
    ], () => {

        // 3) Fetch data from the server
        loadCalendarData().then(events => {
            // 4) Render the calendar
            renderCalendar(containerSelector, events);
        });
    });
}

/*
    loadCalendarData() can be a helper function that calls your existing
    'get_schedule_data' or a custom method that returns events for FullCalendar.
*/
function loadCalendarData() {
    return new Promise((resolve, reject) => {
        frappe.call({
            method: "beveren_fsm.field_service_management.page.dispatch.dispatch.get_schedule_data",
            args: {
                selected_date: frappe.datetime.get_today(),
				all_dates: true
            },
            callback: (r) => {
                if (!r.exc && r.message) {
					console.log(r.message);
					
                    // Convert your appointments into FullCalendar event objects
                    const appointments = r.message.appointments || [];
                    const events = appointments.map(app => {
                        return {
                            id: app.name,
                            title: app.service_order || "No Order",
                            start: combineDateTime(app.posting_date, app.start_time),
                            end: combineDateTime(app.posting_date, app.finish_time),
                            color: app.color || "#007bff",
                            extendedProps: {
                                status: app.status,
                                technicians: app.service_technicians
                            }
                        };
                    });
                    resolve(events);					
                } else {
                    frappe.msgprint("Failed to load calendar data.");
                    resolve([]);
                }
            }
        });
    });
}

/*
    A small helper to combine date + HH:MM into an ISO datetime string
*/
function combineDateTime(dateStr, timeStr) {
    if (!dateStr || !timeStr) return null;
    return `${dateStr}T${timeStr}:00`; 
}

/*
    renderCalendar(containerSelector, events) - sets up FullCalendar in that container
*/
function renderCalendar(containerSelector, events) {
    const calendarEl = document.querySelector(containerSelector);

    // Create a child <div> for FullCalendar if needed
    // But we already have #calendar-page-body, so:
    const fcContainer = document.getElementById("calendar-page-body");

    // Build the calendar
    const calendar = new FullCalendar.Calendar(fcContainer, {
        initialView: "dayGridMonth",
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay"
        },
        navLinks: true,
        editable: false,
        selectable: false,
        events: events,
        eventClick: (info) => {
            onCalendarEventClick(info.event);
        },
        dateClick: (info) => {
            frappe.msgprint(`Clicked date: ${info.dateStr}`);
        }
    });

    calendar.render();
}

/*
    onCalendarEventClick(fcEvent) - handle event clicks
*/
function onCalendarEventClick(fcEvent) {
    // fcEvent is a FullCalendar Event object
    frappe.msgprint(`Event clicked: ${fcEvent.title} (ID: ${fcEvent.id})`);
    // TODO: Show tooltip with the information
}
