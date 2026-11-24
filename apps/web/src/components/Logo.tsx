import horizontalSvg from "../assets/balance-logo-horizontal.svg?raw";
import symbolSvg from "../assets/balance-simbolo.svg?raw";

// Los SVG del logo (design/logo) se pintan con las variables --logo-* para que sigan el tema.
function themed(svg: string, width: number): string {
  return svg
    .replace(/<svg[^>]*viewBox="([^"]+)"[^>]*>/, (_m, vb: string) => {
      const [, , w = "100", h = "100"] = vb.split(" ");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${width}" height="${(width * Number(h)) / Number(w)}" aria-hidden="true">`;
    })
    .replace('fill="#6538e5" stroke="#6538e5"', 'class="lg-t"')
    .replace('fill="#2fd39a" stroke="#2fd39a"', 'class="lg-b"')
    .replace('fill="#1c1830"', 'class="lg-w"');
}

export function LogoSymbol({ size = 40 }: { size?: number }) {
  return (
    <span
      role="img"
      aria-label="Balance"
      style={{ display: "inline-flex" }}
      dangerouslySetInnerHTML={{ __html: themed(symbolSvg, size) }}
    />
  );
}

export function LogoHorizontal({ width = 150, onAccent = false }: { width?: number; onAccent?: boolean }) {
  return (
    <span
      role="img"
      aria-label="Balance"
      className={onAccent ? "on-accent" : undefined}
      style={{ display: "inline-flex" }}
      dangerouslySetInnerHTML={{ __html: themed(horizontalSvg, width) }}
    />
  );
}
