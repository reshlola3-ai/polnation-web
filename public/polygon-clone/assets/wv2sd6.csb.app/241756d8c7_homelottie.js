let animation = lottie.loadAnimation({
  container: document.getElementById("home-lottie"),
  renderer: "svg",
  loop: false,
  autoplay: false,
  path: "./assets/cdn.prod.website-files.com/695f9b8b60e3caf52637f379/b3ebee2d5b_696f4e4513660d46937f9b6c_Asset_OpenStack_webp_forExport_.json",
});

animation.addEventListener("DOMLoaded", function () {
  const totalFrames = animation.totalFrames;

  ScrollTrigger.create({
    trigger: ".oms-what-wrap",
    start: "top 20%", // starts when 25% of element is scrolled
    end: "bottom 80%", // ends at 80%
    scrub: true,
    onUpdate: (self) => {
      const frame = Math.floor(self.progress * (totalFrames - 1));
      animation.goToAndStop(frame, true);
    },
  });
});
