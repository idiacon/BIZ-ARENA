# Biz Arena Logo System

The current runtime asset is `public/assets/biz-arena-logo.svg`. It remains a temporary compact mark until the approved shield direction is exported as production-ready vector assets.

## Primary UI Direction

Use the horizontal `BA` shield plus `BIZ ARENA` wordmark as the main brand. It is the best fit for the desktop header, teacher start screen, installer, README, and presentation title because the symbol and name remain distinct at wide dashboard proportions.

Required production variants:

- transparent shield mark for sidebar, favicon, taskbar, and Windows icon;
- transparent horizontal wordmark for start screens and documents;
- monochrome light and dark variants;
- source SVG plus optimized PNG exports at 64, 128, 256, 512, and 1024 px;
- multi-size `build/icon.ico` generated from the compact shield, not the full wordmark.

## Promotional Direction

Use the city, gold chart, and large `БИЗАРЕНА` badge for covers, splash art, defense slides, and store-style promotional material. It should not be used inside the navigation or as a favicon because its detail and Cyrillic lettering collapse at small sizes.

## Asset Rule

Do not ship the supplied dark-background reference PNG files directly in the runtime. Their backgrounds would create visible rectangles in the OLED interface and add several megabytes. First prepare transparent, tightly cropped exports and verify the compact mark at 16, 32, 48, and 64 px.
