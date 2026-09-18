import os

from dotenv import load_dotenv

load_dotenv()

CATEGORIES = [
    "Food & Dining",
    "Groceries",
    "Transport",
    "Utilities",
    "Rent & Housing",
    "Shopping",
    "Healthcare",
    "Education",
    "Entertainment",
    "Transfer",
    "Salary & Income",
    "Fees & Charges",
    "Other",
]

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5")

GOOGLE_SERVICE_ACCOUNT_FILE = os.environ.get(
    "GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json"
)
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "")
GOOGLE_SHEET_WORKSHEET = os.environ.get("GOOGLE_SHEET_WORKSHEET", "Slips")

SHEET_HEADERS = [
    "Saved At",
    "Date",
    "Time",
    "Amount",
    "Currency",
    "Category",
    "Transaction Type",
    "Sender Name",
    "Sender Account",
    "Receiver Name",
    "Receiver Account",
    "Bank Name",
    "Reference Number",
    "Description",
]
