with open('/home/tanice/Desktop/Kronos/kronos/src/components/StarCreditManager.jsx', 'r') as f:
    text = f.read()

# Update updateStatusVisuals
old_update = """  } else if (status === "destroyed") {
    material.color.setHex(statusColors.destroyed);
    material.emissive.setHex(0xffa500);
    light.color.setHex(0xff4500);
    light.intensity = 2.4;
    if (trailLine?.material) {
      trailLine.material.emissive.setHex(trailColors.destroyed);
    }
  }
}"""

new_update = """  } else if (status === "destroyed") {
    material.color.setHex(statusColors.destroyed);
    material.emissive.setHex(0xffa500);
    light.color.setHex(0xff4500);
    light.intensity = 2.4;
    if (trailLine?.material) {
      trailLine.material.emissive.setHex(trailColors.destroyed);
    }
  } else if (status === "settled") {
    material.color.setHex(0x0088ff);
    material.emissive.setHex(0x00ffff);
    light.color.setHex(0x00ffff);
    light.intensity = 1.0;
    if (trailLine?.material) {
      trailLine.material.emissive.setHex(0x00ffff);
    }
  }
}"""
if old_update in text:
    text = text.replace(old_update, new_update)

# Update removal detection
text = text.replace('if (status === "destroyed" && !entry.removalScheduled) {', 'if ((status === "destroyed" || status === "settled") && !entry.removalScheduled) {')
text = text.replace('removalScheduled: status === "destroyed",', 'removalScheduled: (status === "destroyed" || status === "settled"),')
text = text.replace('if (status === "destroyed") {\n        setTimeout(() => {', 'if (status === "destroyed" || status === "settled") {\n        setTimeout(() => {')
text = text.replace('if (entry.status === "destroyed") {', 'if (entry.status === "destroyed" || entry.status === "settled") {')

with open('/home/tanice/Desktop/Kronos/kronos/src/components/StarCreditManager.jsx', 'w') as f:
    f.write(text)
