import { Final, HowTo } from "./Home.jsx";

// Own page for the "How It Works" navigation item. The section is the same one shown on the home page.
export default function HowItWorks() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6 ">
      <h1 className="sr-only">How It Works — Creator Moves 365</h1>
      <div className="home-storefront">
        <HowTo />
        <Final />
      </div>
    </div>
  );
}
