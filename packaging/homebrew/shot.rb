# Homebrew formula for Shot. It lives in a tap repo (github.com/connorguy/homebrew-shot, Formula/shot.rb)
# so people can run:  brew install connorguy/shot/shot
# Release steps: tag vX.Y.Z on github.com/connorguy/shot (the repo must be public), then set url + sha256:
#   curl -sL https://github.com/connorguy/shot/archive/refs/tags/vX.Y.Z.tar.gz | shasum -a 256
class Shot < Formula
  desc "Timeline editor for films made of code: retime, voice, score and export"
  homepage "https://github.com/connorguy/shot"
  url "https://github.com/connorguy/shot/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "REPLACE_WITH_SHA256_OF_THE_TAG_TARBALL"
  license "BUSL-1.1"

  depends_on "ffmpeg"
  depends_on "node"

  def install
    libexec.install Dir["*"], ".env.example"
    cd libexec do
      system "npm", "ci", "--no-audit", "--no-fund"
    end
    (bin/"shot").write_env_script libexec/"bin/shot.mjs", PATH: "#{Formula["node"].opt_bin}:$PATH"
  end

  def caveats
    <<~EOS
      Shot renders frames with Google Chrome:
        brew install --cask google-chrome      (or set CHROME_PATH in ~/.shot/.env)

      Voiceover and music use Gemini. Either sign in with Application Default Credentials:
        gcloud auth application-default login
      or put GEMINI_API_KEY=... in ~/.shot/.env

      Start the studio with:  shot
      New projects default to ~/Shot; templates you save go to ~/.shot/templates.
    EOS
  end

  test do
    assert_match "video editor", shell_output("#{bin}/shot help")
  end
end
