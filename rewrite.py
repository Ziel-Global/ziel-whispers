import re

with open('src/pages/WorkflowTemplates.tsx.bak', 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'  const gridCols = [^\n]+\n(.*)', text, re.DOTALL)
pre_return = text[:match.start(1)]

with open('ui.txt', 'r', encoding='utf-8') as f:
    ui = f.read()

new_content = pre_return + ui
with open('src/pages/WorkflowTemplates.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)
