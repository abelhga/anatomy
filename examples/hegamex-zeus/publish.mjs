import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { ISO_CSS } from "../../kit/iso-kit.mjs";
import { kitScript } from "../../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? join(HERE, "zeus-thor.html");
for (const args of [["--publish", "--light"], ["--publish", "--two", "--light"]]) execFileSync(process.execPath, [join(HERE, "build.mjs"), ...args], { stdio: "inherit" });
const three = JSON.parse(readFileSync(join(HERE, "part3.json"), "utf8"));
const two = JSON.parse(readFileSync(join(HERE, "part2.json"), "utf8"));

const css = `
:root{--hg-page:#f2f2ef}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--hg-page:#0b0b0b;color-scheme:dark}}
:root[data-theme="dark"]{--hg-page:#0b0b0b;color-scheme:dark}
body{background:var(--hg-page)}
${ISO_CSS}
${three.css}
.hg-page{box-sizing:border-box;max-width:1272px;margin-inline:auto;padding:24px 16px 56px;background:var(--anatomy-page);color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.hg-page *,.hg-page *::before,.hg-page *::after{box-sizing:border-box}
.hg-page .iso-figure{margin:0}
`;

const sync = `
const page = document.querySelector(".hg-page");
const host = document.documentElement;
const dark = matchMedia("(prefers-color-scheme: dark)");
const syncTheme = () => {
  const chosen = host.getAttribute("data-theme");
  page.setAttribute("data-theme", chosen === "dark" || (!chosen && dark.matches) ? "dark" : "light");
};
syncTheme();
dark.addEventListener("change", syncTheme);
new MutationObserver(syncTheme).observe(host, { attributes: true, attributeFilter: ["data-theme"] });
const figures = [...document.querySelectorAll("[data-variant]")];
document.querySelectorAll("[data-variant-set]").forEach((button) =>
  button.addEventListener("click", () => {
    const want = button.dataset.variantSet;
    figures.forEach((figure) => (figure.hidden = figure.dataset.variant !== want));
    document.querySelectorAll("[data-variant-set]").forEach((b) => b.toggleAttribute("data-on", b.dataset.variantSet === want));
  }),
);
`;

const html = `<title>Zeus 30 + Thor 36</title>
<style>${css}</style>
<main class="iso hg-page" data-theme="light">
${three.body}
${two.body}
</main>
<script type="module">${(sync + kitScript() + three.live + two.live).replace(/<\/(script)/gi, "<\\/$1")}</script>
`;
writeFileSync(out, html);
console.log("wrote", out, `${Math.round(html.length / 1024)} KB`);
