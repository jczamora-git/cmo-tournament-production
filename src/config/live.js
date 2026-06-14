export const FACEBOOK_LIVE_URL = import.meta.env.VITE_FACEBOOK_LIVE_URL || "";

export const buildFacebookEmbedUrl = (facebookUrl) => {
  if (!facebookUrl) return "";
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
    facebookUrl
  )}&show_text=false&width=1280`;
};
