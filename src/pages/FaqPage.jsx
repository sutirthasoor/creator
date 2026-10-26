import { Final, Faq } from "./Home.jsx";

// Own page for the "FAQ" navigation item. The section is the same one shown on the home page.
export default function FaqPage() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6 ">
      <h1 className="sr-only">FAQ — Creator Moves 365</h1>
      <div className="home-storefront">
        <Faq />
        <Final />
      </div>
    </div>
  );
}
