"""Shared decimal calculations; no database access in financial arithmetic."""

from decimal import Decimal


MAX_INVOICE_AMOUNT = Decimal('999999999999999')
MAX_ITEM_AMOUNT = Decimal('999999999999')


def final_amount(total, tax=0, discount=0, commission=0):
    total = Decimal(total or 0)
    return total + total * Decimal(tax or 0) / Decimal(100) - Decimal(discount or 0) + Decimal(commission or 0)


def payment_totals(final, status, recorded):
    """Preserve legacy settlement: paid invoices count at least their final total."""
    final, recorded = Decimal(final), Decimal(recorded)
    paid = max(recorded, final) if status == 'paid' else recorded
    return paid, max(Decimal(0), final - paid)


def invoice_payment_totals(invoice):
    # RelatedManager.all() consumes Django's prefetch cache; aggregate() does not.
    recorded = sum((Decimal(payment.amount) for payment in invoice.payments.all()), Decimal(0))
    return payment_totals(invoice.final_amount, invoice.status, recorded)


def office_card_fee(total, source, threshold):
    total, threshold = Decimal(total), Decimal(threshold or 0)
    return total // Decimal(100) if source == 'office' and threshold > 0 and total > threshold else Decimal(0)


def safe_spreadsheet_cell(value):
    """Keep untrusted text literal in both spreadsheet and CSV consumers."""
    if isinstance(value, str) and (value.lstrip().startswith(('=', '+', '-', '@')) or value.startswith(('\t', '\r', '\n'))):
        return "'" + value
    return value
