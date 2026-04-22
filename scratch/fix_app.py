import os

file_path = r'c:\Users\ТИВИЩКА\Downloads\Приложения\AnimTube\app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# The junk starts around line 3313 (index 3312) and ends around 3343 (index 3342)
# But let's look for the specific marker
start_idx = -1
for i, line in enumerate(lines):
    if i > 3300 and 'const card = document.getElementById(`lib-card-${id}`);' in line:
        start_idx = i
        break

if start_idx != -1:
    # Remove from start_idx to the next closing brace + window.deleteFrame or similar
    end_idx = start_idx
    for i in range(start_idx, len(lines)):
        if 'window.deleteFrame = deleteFrame;' in lines[i]:
            # Wait, we want to keep one window.deleteFrame = deleteFrame;
            # Let's just remove 31 lines from start_idx
            end_idx = start_idx + 31
            break
    
    del lines[start_idx:end_idx]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print(f"Successfully removed {end_idx - start_idx} lines starting from {start_idx + 1}")
else:
    print("Could not find the target junk code.")
