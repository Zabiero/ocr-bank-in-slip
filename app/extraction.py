"""Turns a photo of a bank slip / receipt into structured, categorized fields
using Claude's vision + tool-use, so the model returns strict JSON instead of
free text we'd have to parse ourselves."""

import base64

from anthropic import Anthropic

from app.config import ANTHROPIC_API_KEY, CATEGORIES, CLAUDE_MODEL

_EXTRACT_TOOL = {
    "name": "record_slip_details",
    "description": "Record the structured details extracted from a bank slip or receipt image.",
    "input_schema": {
        "type": "object",
        "properties": {
            "date": {"type": "string", "description": "Transaction date as YYYY-MM-DD, or empty string if not visible."},
            "time": {"type": "string", "description": "Transaction time as HH:MM (24h), or empty string if not visible."},
            "amount": {"type": "number", "description": "Transaction amount as a plain number, without currency symbols or thousands separators."},
            "currency": {"type": "string", "description": "ISO-ish currency code or symbol as shown, e.g. MYR, USD, RM."},
            "transaction_type": {
                "type": "string",
                "enum": ["transfer", "payment", "deposit", "withdrawal", "bill", "other"],
                "description": "Best guess at the kind of transaction.",
            },
            "sender_name": {"type": "string", "description": "Payer / sender name, empty string if not present."},
            "sender_account": {"type": "string", "description": "Payer / sender account or card number, empty string if not present."},
            "receiver_name": {"type": "string", "description": "Payee / recipient / merchant name, empty string if not present."},
            "receiver_account": {"type": "string", "description": "Payee / recipient account number, empty string if not present."},
            "bank_name": {"type": "string", "description": "Bank or e-wallet that issued the slip, empty string if not present."},
            "reference_number": {"type": "string", "description": "Transaction / reference / receipt number, empty string if not present."},
            "description": {"type": "string", "description": "Short note, purpose, or remark shown on the slip, empty string if none."},
            "category": {
                "type": "string",
                "enum": CATEGORIES,
                "description": "Best matching spending/income category for this transaction.",
            },
            "confidence": {
                "type": "string",
                "enum": ["high", "medium", "low"],
                "description": "Your overall confidence in the extracted fields.",
            },
        },
        "required": ["amount", "currency", "transaction_type", "category", "confidence"],
    },
}

_PROMPT = (
    "This image is a bank transfer slip, payment receipt, or e-wallet transaction "
    "screenshot. Read every visible field carefully and call record_slip_details with "
    "the extracted values. Leave a field as an empty string if it isn't present in the "
    "image instead of guessing. For `category`, pick the single best match for what the "
    "money was spent on or received for, based on the merchant/description/context."
)


def extract_slip(image_bytes: bytes, media_type: str) -> dict:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Add it to your .env file before extracting slips."
        )

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    image_b64 = base64.standard_b64encode(image_bytes).decode("utf-8")

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1024,
        tools=[_EXTRACT_TOOL],
        tool_choice={"type": "tool", "name": "record_slip_details"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": _PROMPT},
                ],
            }
        ],
    )

    for block in response.content:
        if block.type == "tool_use" and block.name == "record_slip_details":
            return block.input

    raise RuntimeError("Claude did not return structured slip details.")
