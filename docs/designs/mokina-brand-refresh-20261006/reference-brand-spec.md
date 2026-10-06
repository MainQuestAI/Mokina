# Mokina · Liquid Glass

全页原型采用用户提供的 Liquid Glass 色板。原版参考记录见归档 DESIGN-v2.md。

```css
:root {
  --bg: oklch(1.000000 0.000000 0.0000); /* #ffffff */
  --surface: oklch(0.970151 0.000000 0.0000); /* #f5f5f5 */
  --fg: oklch(0.000000 0.000000 0.0000); /* #000000 */
  --muted: oklch(0.640087 0.000000 0.0000); /* #8c8c8c */
  --border: oklch(0.891431 0.000000 0.0000); /* #dbdbdb */
  --accent: oklch(0.669028 0.180780 251.8396); /* #2997ff */
  --action: oklch(0.562923 0.193329 256.1557); /* #0071e3 */
}
```

标题与正文："SF Pro SC", system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif。等宽："SFMono-Regular", Menlo, Consolas, monospace。未打包专有字体。

- 白色实底正文，中性灰环境；玻璃仅用于导航、工具条、输入及菜单。
- 灰色 muted 仅作装饰；正文辅助文字使用黑色派生的可读灰阶。
- 品牌蓝少量使用，操作与焦点使用 action 蓝；不使用大面积染色。
- 圆角按导航、容器、控件层级区分；正文独立于位移层。
- Web 边缘位移与系统原生 Liquid Glass 是不同实现。
