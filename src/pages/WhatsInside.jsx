import { Final, Inside, Preview } from "./Home.jsx";

// Own page for the "What’s Inside" navigation item. The section is the same one shown on the home page.
export default function WhatsInside() {
  return (
    <div className="public-shell mx-auto px-4 pb-10 sm:px-6 ">
      <h1 className="sr-only">What’s Inside — Creator Moves 365</h1>
      <div className="home-storefront">
        <Inside />
        <Preview />
        <Final />
      </div>
    </div>
  );
}
