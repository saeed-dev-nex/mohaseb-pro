"""Iranian identifier validation (stage 4 — first step toward سامانه مؤدیان).

- کد ملی (natural persons, 10 digits): full checksum validation.
- شناسه ملی (legal entities, 11 digits): format validation. Its checksum is
  not enforced yet, deliberately: applying a half-remembered legal-entity
  algorithm would reject real customers, so only shape is checked until the
  official algorithm is verified against issued identifiers.
Persian/Arabic digits and separators are normalized before checking.
"""

from rest_framework import serializers

_DIGIT_TRANSLATION = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def normalize_digits(value):
    return str(value).translate(_DIGIT_TRANSLATION).replace(' ', '').replace('-', '').strip()


def is_valid_national_code(code):
    """True when a 10-digit کد ملی passes the official checksum."""
    if len(code) != 10 or not code.isdigit():
        return False
    if len(set(code)) == 1:  # 1111111111 passes the raw checksum but is not real
        return False
    total = sum(int(code[i]) * (10 - i) for i in range(9))
    remainder = total % 11
    control = int(code[9])
    return control == remainder if remainder < 2 else control == 11 - remainder


def validate_customer_identifier(value):
    """Validate Customer.national_id: accepts کد ملی (10) or شناسه ملی (11).

    Returns the normalized (Latin digits) identifier; raises a Persian
    DRF ValidationError otherwise. Empty values are returned untouched —
    serializers normalize them to None before calling this.
    """
    if value in (None, ''):
        return value
    normalized = normalize_digits(value)
    if len(normalized) == 10:
        if not is_valid_national_code(normalized):
            raise serializers.ValidationError('کد ملی واردشده معتبر نیست (رقم کنترلی درست نیست).')
        return normalized
    if len(normalized) == 11:
        if not normalized.isdigit() or len(set(normalized)) == 1:
            raise serializers.ValidationError('شناسه ملی باید ۱۱ رقم باشد.')
        return normalized
    raise serializers.ValidationError('کد ملی (۱۰ رقم) یا شناسه ملی (۱۱ رقم) را کامل وارد کنید.')


def validate_national_code_field(value):
    """For fields that must be a natural person's کد ملی when provided."""
    if value in (None, ''):
        return value
    normalized = normalize_digits(value)
    if not is_valid_national_code(normalized):
        raise serializers.ValidationError('کد ملی واردشده معتبر نیست (رقم کنترلی درست نیست).')
    return normalized


def validate_tax_id(value):
    """Business tax identifier (شناسه مالیاتی): 11 digits when provided."""
    if value in (None, ''):
        return value
    normalized = normalize_digits(value)
    if len(normalized) != 11 or not normalized.isdigit():
        raise serializers.ValidationError('شناسه مالیاتی باید ۱۱ رقم باشد.')
    return normalized
