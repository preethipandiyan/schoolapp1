import os
from PIL import Image, ImageDraw

def create_icons():
    # Source image: 500x500 high-res logo
    src_path = os.path.abspath('public/logo.png')
    logo = Image.open(src_path).convert('RGBA')

    # Crop tightly to logo contents
    bbox = logo.getbbox()
    cropped_logo = logo.crop(bbox)

    res_dir = os.path.abspath('mobile/android/app/src/main/res')

    # Densities for standard launcher icons
    # Standard: mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
    # Foreground: mdpi=108, hdpi=162, xhdpi=216, xxhdpi=324, xxxhdpi=432
    densities = {
        'mipmap-mdpi': (48, 108),
        'mipmap-hdpi': (72, 162),
        'mipmap-xhdpi': (96, 216),
        'mipmap-xxhdpi': (144, 324),
        'mipmap-xxxhdpi': (192, 432),
    }

    bg_color = (248, 249, 253, 255) # #F8F9FD soft white-lavender

    for folder, (icon_size, fg_size) in densities.items():
        out_dir = os.path.join(res_dir, folder)
        os.makedirs(out_dir, exist_ok=True)

        # 1. FOREGROUND (Adaptive icon) - 108dp canvas, logo fits in safe area (~62% of canvas)
        fg = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        target_logo_size = int(fg_size * 0.62)
        # Preserve aspect ratio
        w_ratio = target_logo_size / cropped_logo.width
        h_ratio = target_logo_size / cropped_logo.height
        ratio = min(w_ratio, h_ratio)
        nw = int(cropped_logo.width * ratio)
        nh = int(cropped_logo.height * ratio)
        scaled_logo = cropped_logo.resize((nw, nh), Image.Resampling.LANCZOS)
        offset_x = (fg_size - nw) // 2
        offset_y = (fg_size - nh) // 2
        fg.paste(scaled_logo, (offset_x, offset_y), scaled_logo)
        fg.save(os.path.join(out_dir, 'ic_launcher_foreground.png'), 'PNG')

        # 2. SQUIRCLE ICON (ic_launcher.png) - High-res super-sampled squircle
        scale = 4
        big_size = icon_size * scale
        big_icon = Image.new('RGBA', (big_size, big_size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(big_icon)
        corner_radius = int(big_size * 0.22)
        draw.rounded_rectangle([(0, 0), (big_size - 1, big_size - 1)], radius=corner_radius, fill=bg_color)
        
        # Center logo
        big_logo_size = int(big_size * 0.72)
        w_ratio = big_logo_size / cropped_logo.width
        h_ratio = big_logo_size / cropped_logo.height
        ratio = min(w_ratio, h_ratio)
        nw = int(cropped_logo.width * ratio)
        nh = int(cropped_logo.height * ratio)
        scaled_logo = cropped_logo.resize((nw, nh), Image.Resampling.LANCZOS)
        offset_x = (big_size - nw) // 2
        offset_y = (big_size - nh) // 2
        big_icon.paste(scaled_logo, (offset_x, offset_y), scaled_logo)
        
        # Downsample for ultra-crisp antialiasing
        final_icon = big_icon.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        final_icon.save(os.path.join(out_dir, 'ic_launcher.png'), 'PNG')

        # 3. ROUND ICON (ic_launcher_round.png)
        big_round = Image.new('RGBA', (big_size, big_size), (0, 0, 0, 0))
        draw_round = ImageDraw.Draw(big_round)
        draw_round.ellipse([(0, 0), (big_size - 1, big_size - 1)], fill=bg_color)
        
        big_round_logo_size = int(big_size * 0.70)
        w_ratio = big_round_logo_size / cropped_logo.width
        h_ratio = big_round_logo_size / cropped_logo.height
        ratio = min(w_ratio, h_ratio)
        nw = int(cropped_logo.width * ratio)
        nh = int(cropped_logo.height * ratio)
        scaled_logo = cropped_logo.resize((nw, nh), Image.Resampling.LANCZOS)
        offset_x = (big_size - nw) // 2
        offset_y = (big_size - nh) // 2
        big_round.paste(scaled_logo, (offset_x, offset_y), scaled_logo)

        final_round = big_round.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        final_round.save(os.path.join(out_dir, 'ic_launcher_round.png'), 'PNG')

    # Also save to mobile/assets/logo.png
    scaled_app_logo = cropped_logo.resize((200, 200), Image.Resampling.LANCZOS)
    scaled_app_logo.save('mobile/assets/logo.png', 'PNG')

    # Create mipmap-anydpi-v26 directory and XMLs
    anydpi_dir = os.path.join(res_dir, 'mipmap-anydpi-v26')
    os.makedirs(anydpi_dir, exist_ok=True)

    adaptive_xml = '''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'''
    with open(os.path.join(anydpi_dir, 'ic_launcher.xml'), 'w') as f:
        f.write(adaptive_xml)
    with open(os.path.join(anydpi_dir, 'ic_launcher_round.xml'), 'w') as f:
        f.write(adaptive_xml)

    # Values colors.xml for background
    values_dir = os.path.join(res_dir, 'values')
    colors_xml = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F8F9FD</color>
</resources>
'''
    with open(os.path.join(values_dir, 'colors.xml'), 'w') as f:
        f.write(colors_xml)

    print("All icons and adaptive XMLs successfully generated!")

if __name__ == '__main__':
    create_icons()
