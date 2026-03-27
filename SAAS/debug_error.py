import re

with open('error.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Find Exception Type and Value
type_match = re.search(r'<th>Exception Type:</th>\s*<td>([^<]+)</td>', html)
value_match = re.search(r'<th>Exception Value:</th>\s*<td><pre>([^<]+)</pre>', html)
local_vars = re.search(r'Exception Location:</th>\s*<td>([^<]+)</td>', html)

if type_match:
    print("Exception Type:", type_match.group(1).strip())
if value_match:
    print("Exception Value:", value_match.group(1).strip())
if local_vars:
    print("Exception Location:", local_vars.group(1).strip())
