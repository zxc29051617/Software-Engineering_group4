# Software-Engineering_group4

Bubble Sort Visualizer for a software engineering group project.

## Project Structure

```text
Software Engineering_4/
+-- frontend/      # 前端畫面與互動
|   +-- index.html
|   +-- src/
|   |   +-- app.js
|   |   +-- style.css
|   |   +-- components/
|   |   `-- assets/
|   `-- package.json
+-- backend/       # 排序邏輯或 API
+-- ui-design/     # UI 設計圖、截圖、mockup
+-- docs/          # 需求、流程圖、使用案例、設計說明
+-- test/          # 測試程式
`-- README.md      # 專案說明與如何執行
```

## How to Run

### Online Demo

GitHub Pages:

https://zxc29051617.github.io/Software-Engineering_group4/

### Run Locally

Open the frontend page in a browser:

```bash
cd frontend
start index.html
```

Check frontend JavaScript syntax:

```powershell
cd frontend
npm run check
```

## Current Features

- Enter the number of values to sort, from 2 to 10.
- Generate input boxes dynamically.
- Validate each input value.
- Visualize Bubble Sort step by step.
- Show the sorted result and reset option.
