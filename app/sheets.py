"""Appends confirmed slip rows to a Google Sheet using a service account."""

import os
from datetime import datetime, timezone

import gspread
from google.oauth2.service_account import Credentials

from app.config import (
    GOOGLE_SERVICE_ACCOUNT_FILE,
    GOOGLE_SHEET_ID,
    GOOGLE_SHEET_WORKSHEET,
    SHEET_HEADERS,
)

_SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
]

_client = None


def _get_client() -> gspread.Client:
    global _client
    if _client is None:
        if not os.path.exists(GOOGLE_SERVICE_ACCOUNT_FILE):
            raise RuntimeError(
                f"Google service account file not found at "
                f"'{GOOGLE_SERVICE_ACCOUNT_FILE}'. Set GOOGLE_SERVICE_ACCOUNT_FILE "
                "in your .env and share the sheet with the service account email."
            )
        creds = Credentials.from_service_account_file(
            GOOGLE_SERVICE_ACCOUNT_FILE, scopes=_SCOPES
        )
        _client = gspread.authorize(creds)
    return _client


def _get_worksheet():
    if not GOOGLE_SHEET_ID:
        raise RuntimeError("GOOGLE_SHEET_ID is not set. Add it to your .env file.")

    client = _get_client()
    spreadsheet = client.open_by_key(GOOGLE_SHEET_ID)

    try:
        worksheet = spreadsheet.worksheet(GOOGLE_SHEET_WORKSHEET)
    except gspread.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(
            title=GOOGLE_SHEET_WORKSHEET, rows=1000, cols=len(SHEET_HEADERS)
        )
        worksheet.append_row(SHEET_HEADERS)
        return worksheet

    first_row = worksheet.row_values(1)
    if first_row != SHEET_HEADERS:
        worksheet.insert_row(SHEET_HEADERS, index=1)

    return worksheet


def append_slip(fields: dict) -> None:
    worksheet = _get_worksheet()
    row = [
        datetime.now(timezone.utc).isoformat(timespec="seconds"),
        fields.get("date", ""),
        fields.get("time", ""),
        fields.get("amount", ""),
        fields.get("currency", ""),
        fields.get("category", ""),
        fields.get("transaction_type", ""),
        fields.get("sender_name", ""),
        fields.get("sender_account", ""),
        fields.get("receiver_name", ""),
        fields.get("receiver_account", ""),
        fields.get("bank_name", ""),
        fields.get("reference_number", ""),
        fields.get("description", ""),
    ]
    worksheet.append_row(row, value_input_option="USER_ENTERED")
