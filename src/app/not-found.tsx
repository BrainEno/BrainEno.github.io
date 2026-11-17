import type { Metadata } from "next";
import { asset } from "@/portfolio/seo/asset";

/**
 * The 404 page. Static hosts export this route as `404.html` and serve it for
 * any unknown path, so it is a visitor's only word when a link rots (#75).
 *
 * It is bilingual on purpose: the site itself is zh/en, but a 404 is triggered
 * by the URL alone — nothing is known about who is reading. Both languages
 * get a line, the navigation stays minimal, and the tone matches the rest of
 * the portfolio (a physical place — a gallery floor — where something asked
 * for is simply not hung on the wall).
 *
 * A Server Component: no interactivity, no bundle beyond the shared one.
 */
export const metadata: Metadata = {
  title: "404 — 信号不在服务区",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="nf">
      <p className="nf-code" aria-hidden="true">
        404
      </p>
      <h1 className="nf-title">
        <span>这里没有信号。</span>
        <span lang="en" className="nf-lang-en">
          There was never anything here.
        </span>
      </h1>
      <p className="nf-copy">
        <span>这台电视只播准备好的频道——链接里写的那个不在其列。</span>
        <span lang="en" className="nf-lang-en">
          This television only tunes to the channels that were prepared. The one in that link was not.
        </span>
      </p>
      <nav className="nf-nav" aria-label="有效的地方 / Still-working places">
        <a className="nf-link" href={asset("/")} data-cursor="view">
          <span>回首页</span>
          <span lang="en" className="nf-lang-en">
            Back to the index
          </span>
        </a>
        <a className="nf-link" href={asset("/#works")} data-cursor="view">
          <span>去看作品</span>
          <span lang="en" className="nf-lang-en">
            To the works
          </span>
        </a>
      </nav>
    </div>
  );
}
