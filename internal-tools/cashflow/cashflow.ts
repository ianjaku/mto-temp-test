
function onOpen() {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    spreadsheet.setSpreadsheetTimeZone("GMT");
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("Update cashflow")
        .addItem("Update", "updateCashflow")
        .addToUi();
}


