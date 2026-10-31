# Software Engineering Group 4：Bubble Sort Visualizer

軟體工程課程第 4 組的專題：在網頁上一步步呈現 Bubble Sort 的排序過程。

網站：https://zxc29051617.github.io/Software-Engineering_group4/

## 功能

- 輸入要排序的數字個數（2 到 10 個），動態產生輸入框並檢查每個輸入值
- 一步步顯示 Bubble Sort 的比較與交換
- 顯示排序結果，可以重新開始

## 專案結構

```text
.
├── README.md
├── index.html        # 網頁入口
├── frontend/         # 前端畫面與互動：src/app.js、src/style.css
├── backend/          # 排序與輸入檢查：bubblesort.js
└── ui-design/        # UI 設計草圖
```

## 執行方式

直接用瀏覽器打開 `index.html`。網站以 GitHub Pages 發布（`main` 分支根目錄）。

檢查前端 JavaScript 語法：

```bash
cd frontend
npm run check
```
