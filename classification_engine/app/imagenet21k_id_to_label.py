from __future__ import annotations

import csv
from pathlib import Path

# Dictionary that stores in the form id, label
# Since Dicts are hash tables we can therefore do this in O(1) time once it's set-up
imagenet21k_dict = {}

CSV_PATH = Path(__file__).resolve().parent / "imagenet21k_ids_with_classnames.csv"


def compose_imagenet_21k_dict():
    with CSV_PATH.open(newline="", encoding="utf-8") as csv_file:
        csv_reader = csv.reader(csv_file, delimiter=",")
        for i, row in enumerate(csv_reader):
            if len(row) > 1:
                imagenet21k_dict[i] = row[1]


def get_label_from_imagenet_21k(id):
    return imagenet21k_dict.get(id)


def imagenet21k_dict_empty():
    return imagenet21k_dict == {}