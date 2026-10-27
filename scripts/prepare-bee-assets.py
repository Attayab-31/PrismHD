"""Build the matched bee cutout and its scroll-synchronized cleanup patch."""
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = ROOT / "public/images/sample-after.png"
source = cv2.imread(str(SOURCE_PATH), cv2.IMREAD_COLOR)
if source is None:
    raise FileNotFoundError(SOURCE_PATH)
height, width = source.shape[:2]
scale = 3
mask = np.zeros((height * scale, width * scale), dtype=np.uint8)


def points(coords):
    return np.asarray([[(round(x * scale), round(y * scale)) for x, y in coords]], dtype=np.int32)


def polygon(coords):
    cv2.fillPoly(mask, points(coords), 255, lineType=cv2.LINE_AA)


def stroke(coords, thickness):
    cv2.polylines(mask, points(coords), False, 255, thickness * scale, lineType=cv2.LINE_AA)
    radius = round(thickness * scale / 2)
    for x, y in (coords[0], coords[-1]):
        cv2.circle(mask, (round(x * scale), round(y * scale)), radius, 255, -1, lineType=cv2.LINE_AA)


# Trace the wing as a rounded shape so its tip does not end at the source frame.
polygon([
    (8, 57), (11, 51), (19, 47), (34, 44), (59, 43), (91, 46), (126, 50),
    (163, 57), (200, 67), (237, 80), (274, 94), (311, 111), (348, 128),
    (382, 144), (413, 157), (438, 168), (451, 177), (455, 184), (450, 191),
    (440, 194), (425, 191), (403, 185), (376, 178), (346, 174), (315, 178),
    (282, 169), (249, 159), (215, 151), (185, 154), (164, 162), (142, 157),
    (116, 146), (91, 134), (66, 122), (43, 110), (25, 98), (14, 87), (8, 75),
])

# Preserve the overlap where the swept wing joins the thorax.
polygon([(164, 162), (179, 154), (197, 149), (217, 150), (237, 155), (217, 166), (193, 174), (175, 176), (165, 171)])

# Main abdomen, thorax, and head silhouette. The separate paths below preserve
# the fine legs and antenna instead of joining them into a clipped polygon.
polygon([
    (171, 228), (166, 210), (171, 192), (183, 177), (202, 164), (224, 155),
    (247, 153), (272, 158), (295, 170), (314, 184), (330, 184), (344, 168),
    (361, 151), (382, 135), (405, 120), (430, 107), (456, 98), (481, 94),
    (505, 97), (527, 107), (546, 123), (564, 146), (579, 172), (591, 202),
    (599, 232), (599, 259), (593, 282), (581, 301), (565, 315), (547, 324),
    (530, 324), (515, 314), (503, 298), (490, 286), (473, 280), (456, 283),
    (441, 294), (428, 310), (415, 325), (400, 334), (386, 333), (373, 326),
    (359, 311), (347, 292), (337, 273), (325, 262), (313, 270), (303, 289),
    (294, 315), (283, 343), (270, 370), (254, 394), (236, 413), (217, 423),
    (199, 420), (183, 408), (169, 390), (158, 371), (152, 350), (154, 329),
    (163, 306), (169, 280),
])

# Three legs and the complete antenna, traced from the source pixels.
stroke([(300, 318), (297, 342), (296, 369), (292, 399), (283, 429), (270, 452), (260, 465)], 12)
stroke([(383, 316), (399, 332), (415, 354), (430, 382), (441, 412), (449, 441), (453, 458)], 10)
stroke([(507, 304), (520, 319), (531, 341), (543, 363), (560, 382), (584, 397), (609, 408), (621, 415)], 10)
stroke([(625, 193), (630, 197), (634, 211), (635, 232), (635, 251), (639, 278), (641, 300), (640, 309)], 8)
stroke([(610, 203), (617, 198), (624, 196), (628, 202), (625, 212)], 6)
stroke([(592, 229), (601, 230), (610, 228), (619, 229), (628, 231)], 10)

alpha = cv2.resize(mask, (width, height), interpolation=cv2.INTER_AREA)
alpha = cv2.GaussianBlur(alpha, (0, 0), 0.55)
rgba = cv2.cvtColor(source, cv2.COLOR_BGR2BGRA)
rgba[:, :, 3] = alpha
ys, xs = np.where(alpha > 2)
pad = 3
x0, x1 = max(0, int(xs.min()) - pad), min(width, int(xs.max()) + pad + 1)
y0, y1 = max(0, int(ys.min()) - pad), min(height, int(ys.max()) + pad + 1)
cv2.imwrite(str(ROOT / "public/images/bee-flight-sprite.png"), rgba[y0:y1, x0:x1])

# Produce a small feathered patch: the source bee remains visible until the
# sprite starts to lift, then this patch replaces only the pixels it vacates.
solid = np.where(alpha > 32, 255, 0).astype(np.uint8)
erase_mask = cv2.dilate(solid, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (81, 81)))
small_source = cv2.resize(source, (width // 4, height // 4), interpolation=cv2.INTER_AREA)
small_mask = cv2.resize(erase_mask, (width // 4, height // 4), interpolation=cv2.INTER_NEAREST)
small_clean = cv2.inpaint(small_source, small_mask, 18, cv2.INPAINT_TELEA)
clean = cv2.resize(small_clean, (width, height), interpolation=cv2.INTER_CUBIC)
patch_alpha = cv2.GaussianBlur(erase_mask, (0, 0), 5)
patch = cv2.cvtColor(clean, cv2.COLOR_BGR2BGRA)
patch[:, :, 3] = patch_alpha
cv2.imwrite(str(ROOT / "public/images/bee-background-patch.png"), patch)
print(f"cutout bounds {x0},{y0}..{x1},{y1}; sprite {x1-x0}x{y1-y0}")
