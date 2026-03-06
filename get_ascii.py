import urllib.request
text = urllib.request.urlopen("https://asciified.thelicato.io/api/v2/ascii?text=BODY+TRACKER&font=ANSI+Shadow").read().decode("utf-8")
with open("temp_ascii.txt", "w", encoding="utf-8") as f:
    f.write(text.strip('\n'))
