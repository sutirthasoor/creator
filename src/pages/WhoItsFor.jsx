import { Final, Audience } from "./Home.jsx";

// Own page for the "Who It’s For" navigation item. The section is the same one shown on the home page.
export default function WhoItsFor() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6 ">
      <h1 className="sr-only">Who It’s For — Creator Moves 365</h1>
      <div className="home-storefront">
        <Audience />
        <Final />
      </div>
    </div>
  );
}
