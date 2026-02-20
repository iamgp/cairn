from cairn_demo import add


def test_add_positive_values() -> None:
    assert add(2, 3) == 5


def test_add_with_negative_value() -> None:
    assert add(4, -1) == 3


def test_intentional_failure_for_cairn_demo() -> None:
    assert add(1, 1) == 3
