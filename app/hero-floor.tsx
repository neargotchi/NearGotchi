/*
  Vaporwave floor under the hero scene (tasks 095, 096): a grid plane in real CSS 3D perspective that rides
  forward in a seamless loop. The scene PNG (public/hero/*.png, scripts/build_hero_scene.py) ends at the horizon;
  this draws everything below it. Styles and the loop: app/hero-header.css (.hero-floor).
*/
export default function HeroFloor() {
  return (
    <>
      <div className="hero-floor" aria-hidden="true">
        <div className="hero-floor-plane" />
        <div className="hero-floor-fade" />
      </div>
      <div className="hero-horizon" aria-hidden="true" />
    </>
  );
}
