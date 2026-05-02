import io
import json
import sys
from typing import Any

from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


PAGE_WIDTH = 828
PAGE_HEIGHT = 612
PAGE_SIZE = (PAGE_WIDTH, PAGE_HEIGHT)
LEFT_MARGIN = 24
RIGHT_MARGIN = 24
TOP_RESERVED = 48
BOTTOM_RESERVED = 28
TABLE_HEADER_HEIGHT = 30
FIRST_PAGE_INFO_HEIGHT = 74
FIRST_PAGE_BOTTOM_BLOCK_HEIGHT = 112
DEFAULT_ROW_HEIGHT = 18
HEADER_LINE_COLOR = colors.HexColor("#222222")
SUBTOTAL_FILL = colors.HexColor("#f0f0f0")
TOTAL_FILL = colors.HexColor("#e4e7eb")
PAY_SUMMARY_BLOCK_X = 420
PAY_SUMMARY_BLOCK_Y = 54
PAY_SUMMARY_BLOCK_HEIGHT = FIRST_PAGE_BOTTOM_BLOCK_HEIGHT - 8
FIRST_PAGE_TABLE_PADDING = 12

COLUMN_WIDTHS = [94, 54, 60, 60, 60, 48, 50, 50, 46, 56, 202]
COLUMN_LABELS = [
    "Date",
    "Actual In",
    "Actual Out",
    "Edited/Rounded In",
    "Edited/Rounded Out",
    "Dept",
    "In/Out hours",
    "Daily REG",
    "Daily OT",
    "Weekly Total",
    "Punch Info",
]


def split_lines(value: str) -> list[str]:
    return [line for line in (value or "").split("\n") if line] or [""]


def wrap_text_to_width(value: str, width: float, font_name: str, font_size: float) -> list[str]:
    wrapped: list[str] = []

    for source_line in split_lines(value):
        words = source_line.split()

        if not words:
            wrapped.append("")
            continue

        current = words[0]

        for word in words[1:]:
            candidate = f"{current} {word}"
            if stringWidth(candidate, font_name, font_size) <= width:
                current = candidate
                continue

            wrapped.append(current)

            if stringWidth(word, font_name, font_size) <= width:
                current = word
                continue

            partial = ""
            for char in word:
                candidate_partial = f"{partial}{char}"
                if partial and stringWidth(candidate_partial, font_name, font_size) > width:
                    wrapped.append(partial)
                    partial = char
                else:
                    partial = candidate_partial
            current = partial

        wrapped.append(current)

    return wrapped or [""]


def draw_text_block(pdf: canvas.Canvas, x: float, y: float, width: float, lines: list[str], font_name: str, font_size: float, leading: float) -> None:
    text = pdf.beginText(x, y)
    text.setFont(font_name, font_size)
    text.setLeading(leading)
    for line in lines:
        text.textLine(line)
    pdf.drawText(text)


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args: Any, report: dict[str, Any], **kwargs: Any) -> None:
        super().__init__(*args, pagesize=PAGE_SIZE, pageCompression=0, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []
        self._report = report

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        total_pages = len(self._saved_page_states)

        for state in self._saved_page_states:
            self.__dict__.update(state)
            draw_page_chrome(self, self._report, total_pages)
            super().showPage()

        super().save()


def draw_page_chrome(pdf: canvas.Canvas, report: dict[str, Any], total_pages: int) -> None:
    page_number = pdf.getPageNumber()
    page_meta = getattr(pdf, "_page_meta", {}) or {}

    pdf.setStrokeColor(HEADER_LINE_COLOR)
    pdf.setLineWidth(0.8)
    pdf.line(LEFT_MARGIN, PAGE_HEIGHT - TOP_RESERVED + 4, PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - TOP_RESERVED + 4)
    pdf.line(LEFT_MARGIN, BOTTOM_RESERVED + 8, PAGE_WIDTH - RIGHT_MARGIN, BOTTOM_RESERVED + 8)

    pdf.setFont("Helvetica-Bold", 14)
    pdf.drawString(LEFT_MARGIN, PAGE_HEIGHT - 28, report["reportTitle"])

    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(LEFT_MARGIN, PAGE_HEIGHT - 40, f'{report["propertyName"]}  |  {report["versionLabel"]}  |  {report["payClassLabel"]}')

    if page_meta.get("employee_name"):
        pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 28, page_meta["employee_name"])
        pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 40, report["payPeriodLabel"])
    else:
        pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 28, report["payPeriodLabel"])
        pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, PAGE_HEIGHT - 40, report["generatedAtLabel"])

    pdf.setFont("Helvetica", 8.5)
    pdf.drawString(LEFT_MARGIN, 14, report["generatedAtLabel"])
    pdf.drawRightString(PAGE_WIDTH - RIGHT_MARGIN, 14, f"Page {page_number} of {total_pages}")


def draw_cover_page(pdf: canvas.Canvas, report: dict[str, Any]) -> None:
    pdf._page_meta = {"employee_name": None}
    summary = report["coverSummary"]
    legend = report["legend"]

    pdf.setFont("Helvetica-Bold", 22)
    pdf.drawString(LEFT_MARGIN, 536, report["reportTitle"])
    pdf.setFont("Helvetica", 11)
    pdf.drawString(LEFT_MARGIN, 516, f'Property: {summary["propertyName"]}')
    pdf.drawString(LEFT_MARGIN, 500, f'Payroll Run: {summary["versionLabel"]}')
    pdf.drawString(LEFT_MARGIN, 484, f'Pay Period: {report["payPeriodLabel"]}')
    pdf.drawString(LEFT_MARGIN, 468, f'Generated: {report["generatedAtLabel"]}')

    card_top = 432
    card_height = 82
    card_width = 180
    card_gap = 12
    cards = [
        ("Employees", str(summary["employeeCount"])),
        ("Regular Hours", summary["regularHoursLabel"]),
        ("Overtime Hours", summary["overtimeHoursLabel"]),
        ("Estimated Gross", summary["estimatedGrossLabel"]),
    ]

    for index, (label, value) in enumerate(cards):
        x = LEFT_MARGIN + index * (card_width + card_gap)
        pdf.setFillColor(colors.white)
        pdf.setStrokeColor(colors.HexColor("#c5cbd3"))
        pdf.roundRect(x, card_top - card_height, card_width, card_height, 12, stroke=1, fill=1)
        pdf.setFillColor(colors.black)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(x + 14, card_top - 24, label)
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(x + 14, card_top - 52, value)

    legend_top = 304
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(LEFT_MARGIN, legend_top, "Exception Legend")
    pdf.setFont("Helvetica", 10)
    current_y = legend_top - 24
    for item in legend:
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(LEFT_MARGIN, current_y, item["code"])
        pdf.setFont("Helvetica", 10)
        pdf.drawString(LEFT_MARGIN + 86, current_y, item["description"])
        current_y -= 18

    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(LEFT_MARGIN, 178, "Employee Detail Export")
    draw_text_block(
        pdf,
        LEFT_MARGIN,
        156,
        PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN,
        [
            "This report is sourced only from frozen payroll-run summaries and shift snapshots.",
            "Draft and in-review payroll runs are intentionally excluded from PDF export.",
            "Each employee section includes weekly subtotals, pay-period totals, and frozen approval metadata.",
        ],
        "Helvetica",
        10,
        14,
    )


def draw_employee_info(pdf: canvas.Canvas, employee: dict[str, Any]) -> None:
    info_top = PAGE_HEIGHT - TOP_RESERVED - 10
    left_x = LEFT_MARGIN
    right_x = 420

    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(left_x, info_top, employee["name"])
    pdf.setFont("Helvetica", 9)
    pdf.drawString(left_x, info_top - 16, f'Employee Group: {employee["employeeGroupLabel"] or "-"}')
    pdf.drawString(left_x, info_top - 30, f'Pay Class: {employee["payClassLabel"]}')
    pdf.drawString(left_x, info_top - 44, f'From: {employee["payPeriodFromLabel"]}')
    pdf.drawString(left_x, info_top - 58, f'To: {employee["payPeriodToLabel"]}')

    pdf.setFont("Helvetica", 9)
    pdf.drawString(right_x, info_top, f'Approval Status: {employee["approvalStatusLabel"]}')
    pdf.drawString(right_x, info_top - 16, f'Approved By: {employee["approvedByLabel"] or "-"}')
    pdf.drawString(right_x, info_top - 30, f'Approved At: {employee["approvedAtLabel"] or "-"}')


def draw_pay_summary(pdf: canvas.Canvas, employee: dict[str, Any]) -> None:
    block_x = PAY_SUMMARY_BLOCK_X
    block_y = PAY_SUMMARY_BLOCK_Y
    block_width = PAGE_WIDTH - block_x - RIGHT_MARGIN
    block_height = PAY_SUMMARY_BLOCK_HEIGHT

    pdf.setStrokeColor(colors.HexColor("#b7bdc8"))
    pdf.setFillColor(colors.white)
    pdf.roundRect(block_x, block_y, block_width, block_height, 10, stroke=1, fill=1)

    pdf.setFillColor(colors.black)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(block_x + 12, block_y + block_height - 18, "PAY TYPE")
    pdf.drawString(block_x + 80, block_y + block_height - 18, "APPLIED AS")
    pdf.drawString(block_x + 150, block_y + block_height - 18, "HOURLY RATE")
    pdf.drawString(block_x + 238, block_y + block_height - 18, "MODIFIER")
    pdf.drawString(block_x + 300, block_y + block_height - 18, "HOURS")
    pdf.drawRightString(block_x + block_width - 12, block_y + block_height - 18, "AMOUNT")

    row_y = block_y + block_height - 36
    pdf.setFont("Helvetica", 9)
    for row in employee["paySummaryRows"]:
        pdf.drawString(block_x + 12, row_y, row["payType"])
        pdf.drawString(block_x + 84, row_y, row["appliedAs"])
        pdf.drawString(block_x + 154, row_y, row["hourlyRateLabel"])
        pdf.drawString(block_x + 244, row_y, row["rateModifierLabel"])
        pdf.drawString(block_x + 306, row_y, row["hoursLabel"])
        pdf.drawRightString(block_x + block_width - 12, row_y, row["amountLabel"])
        row_y -= 16

    pdf.setLineWidth(0.6)
    pdf.line(block_x + 12, row_y + 6, block_x + block_width - 12, row_y + 6)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(block_x + 12, row_y - 8, "Totals")
    pdf.drawString(block_x + 306, row_y - 8, employee["paySummaryTotals"]["hoursLabel"])
    pdf.drawRightString(block_x + block_width - 12, row_y - 8, employee["paySummaryTotals"]["amountLabel"])


def draw_table_header(pdf: canvas.Canvas, top_y: float) -> float:
    x = LEFT_MARGIN
    pdf.setFillColor(colors.HexColor("#0f172a"))
    pdf.rect(LEFT_MARGIN, top_y - TABLE_HEADER_HEIGHT, PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, TABLE_HEADER_HEIGHT, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 7.5)

    multiline_labels = {
        "Actual In": "Actual\nIn",
        "Actual Out": "Actual\nOut",
        "Edited/Rounded In": "Edited/\nRounded In",
        "Edited/Rounded Out": "Edited/\nRounded Out",
    }

    for width, label in zip(COLUMN_WIDTHS, COLUMN_LABELS):
        lines = split_lines(multiline_labels.get(label, label))
        draw_text_block(pdf, x + 3, top_y - 11, width - 6, lines, "Helvetica-Bold", 7.3, 8)
        x += width

    pdf.setFillColor(colors.black)
    return top_y - TABLE_HEADER_HEIGHT


def row_height_for(row: dict[str, Any]) -> float:
    max_lines = 1
    values = [
        row["businessDateLabel"],
        row["actualInDisplay"],
        row["actualOutDisplay"],
        row["editedInDisplay"],
        row["editedOutDisplay"],
        row["departmentLabel"],
        row["inOutHours"],
        row["dailyRegHours"],
        row["dailyOtHours"],
        row["weeklyTotalHours"],
        row["punchInfo"],
    ]
    for width, value in zip(COLUMN_WIDTHS, values):
        wrapped_lines = wrap_text_to_width(value, width - 6, "Helvetica", 7.2)
        max_lines = max(max_lines, len(wrapped_lines))
    return max(DEFAULT_ROW_HEIGHT, 8 + max_lines * 8)


def draw_row(pdf: canvas.Canvas, row: dict[str, Any], top_y: float) -> float:
    height = row_height_for(row)
    fill_color = colors.white
    if row["kind"] == "weekly_total":
        fill_color = SUBTOTAL_FILL
    elif row["kind"] == "period_total":
        fill_color = TOTAL_FILL

    pdf.setFillColor(fill_color)
    pdf.setStrokeColor(colors.HexColor("#d3d8df"))
    pdf.rect(LEFT_MARGIN, top_y - height, PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, height, stroke=1, fill=1)
    pdf.setFillColor(colors.black)
    x = LEFT_MARGIN
    font_name = "Helvetica-Bold" if row["kind"] != "shift" else "Helvetica"

    values = [
        row["businessDateLabel"],
        row["actualInDisplay"],
        row["actualOutDisplay"],
        row["editedInDisplay"],
        row["editedOutDisplay"],
        row["departmentLabel"],
        row["inOutHours"],
        row["dailyRegHours"],
        row["dailyOtHours"],
        row["weeklyTotalHours"],
        row["punchInfo"],
    ]

    for width, value in zip(COLUMN_WIDTHS, values):
        wrapped_lines = wrap_text_to_width(value, width - 6, font_name, 7.2)
        draw_text_block(pdf, x + 3, top_y - 11, width - 6, wrapped_lines, font_name, 7.2, 8)
        x += width

    return top_y - height


def draw_employee_section(pdf: canvas.Canvas, employee: dict[str, Any]) -> None:
    rows = employee["rows"]
    row_index = 0
    first_page = True

    while row_index < len(rows):
        pdf._page_meta = {"employee_name": employee["name"]}

        if first_page:
            draw_employee_info(pdf, employee)
            draw_pay_summary(pdf, employee)
            table_top = PAGE_HEIGHT - TOP_RESERVED - FIRST_PAGE_INFO_HEIGHT
            table_bottom = PAY_SUMMARY_BLOCK_Y + PAY_SUMMARY_BLOCK_HEIGHT + FIRST_PAGE_TABLE_PADDING
        else:
            table_top = PAGE_HEIGHT - TOP_RESERVED - 12
            table_bottom = BOTTOM_RESERVED + 12

        current_y = draw_table_header(pdf, table_top)

        while row_index < len(rows):
            row = rows[row_index]
            height = row_height_for(row)
            if current_y - height < table_bottom:
                break
            current_y = draw_row(pdf, row, current_y)
            row_index += 1

        if row_index < len(rows):
            pdf.showPage()
            first_page = False
        else:
            break


def main() -> None:
    report = json.load(sys.stdin)
    buffer = io.BytesIO()
    pdf = NumberedCanvas(buffer, report=report)

    draw_cover_page(pdf, report)
    if report["employees"]:
        pdf.showPage()

    for index, employee in enumerate(report["employees"]):
        draw_employee_section(pdf, employee)
        if index < len(report["employees"]) - 1:
            pdf.showPage()

    pdf.save()
    sys.stdout.buffer.write(buffer.getvalue())


if __name__ == "__main__":
    main()
