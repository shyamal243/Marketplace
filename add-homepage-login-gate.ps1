$path = "apps\web\app\page.tsx"
if (-not (Test-Path $path)) {
    Write-Host "Could not find $path - run this from the repo root." -ForegroundColor Red
    exit 1
}

$rawContent = [System.IO.File]::ReadAllText((Resolve-Path $path).Path)
$hadCrLf = $rawContent.Contains("`r`n")
$content = $rawContent.Replace("`r`n", "`n")

function Apply-Edit {
    param($content, $old, $new, $label)
    $oldN = $old.Replace("`r`n", "`n")
    $newN = $new.Replace("`r`n", "`n")
    if ($content.Contains($oldN)) {
        Write-Host "Applied: $label" -ForegroundColor Green
        return $content.Replace($oldN, $newN)
    } else {
        Write-Host "FAILED to find anchor for: $label" -ForegroundColor Red
        return $content
    }
}

# 1. Add teaser copy array, right after LANDING_TABS
$old1 = @'
const LANDING_TABS: { key: LandingTab; label: string }[] = [
  { key: "postdemand", label: "Post a Demand" },
  { key: "ecommerce", label: "E/Q-Commerce" },
  { key: "professionals", label: "Professionals" },
  { key: "logistics", label: "Logistics" },
];
'@
$new1 = @'
const LANDING_TABS: { key: LandingTab; label: string }[] = [
  { key: "postdemand", label: "Post a Demand" },
  { key: "ecommerce", label: "E/Q-Commerce" },
  { key: "professionals", label: "Professionals" },
  { key: "logistics", label: "Logistics" },
];

const LANDING_TAB_PREVIEWS: { key: LandingTab; label: string; blurb: string }[] = [
  { key: "postdemand", label: "Post a Demand", blurb: "Describe what you need and let sellers bid for your business." },
  { key: "ecommerce", label: "E/Q-Commerce", blurb: "Shop from nearby stores across food, medicines, electricals, clothes and more." },
  { key: "professionals", label: "Professionals", blurb: "Book maids, mechanics, tutors, doctors and other local professionals." },
  { key: "logistics", label: "Logistics", blurb: "Book rides, deliveries, vehicle rentals, and print & document delivery." },
];
'@
$content = Apply-Edit $content $old1 $new1 "LANDING_TAB_PREVIEWS constant"

# 2. Wrap the start of the tab section: everything from the tab bar onward is only for logged-in users
$old2 = @'
      <div className="mx-auto max-w-2xl px-8 pt-8 md:px-16">
        <div className="flex gap-2 overflow-x-auto border-b border-rv-border pb-2">
          {LANDING_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 whitespace-nowrap rounded-md px-4 py-2 font-body text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-rv-magenta text-rv-bg shadow-hud-glow-magenta"
                  : "border border-rv-border text-rv-text-dim hover:hud-border hover:text-rv-cyan"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "postdemand" && (
'@
$new2 = @'
      {user ? (
        <>
      <div className="mx-auto max-w-2xl px-8 pt-8 md:px-16">
        <div className="flex gap-2 overflow-x-auto border-b border-rv-border pb-2">
          {LANDING_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 whitespace-nowrap rounded-md px-4 py-2 font-body text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-rv-magenta text-rv-bg shadow-hud-glow-magenta"
                  : "border border-rv-border text-rv-text-dim hover:hud-border hover:text-rv-cyan"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "postdemand" && (
'@
$content = Apply-Edit $content $old2 $new2 "wrap start of tab section behind login"

# 3. Wrap the end of the tab section, adding the logged-out teaser as the else branch
$old3 = @'
          </main>
        </>
      )}
    </div>
  );
}
'@
$new3 = @'
          </main>
        </>
      )}
        </>
      ) : (
        <main className="mx-auto max-w-3xl px-8 py-16 md:px-16">
          <h1 className="font-display text-3xl font-semibold text-rv-text">
            Everything you need, in one place
          </h1>
          <p className="mt-3 font-body text-sm text-rv-text-dim">
            Post a demand and let sellers come to you, shop nearby stores, book a professional, or arrange
            logistics. Log in or sign up to explore the full marketplace.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {LANDING_TAB_PREVIEWS.map((tab) => (
              <Link
                key={tab.key}
                href="/login"
                className="glass-panel flex flex-col gap-2 p-6 transition hover:hud-border"
              >
                <span className="font-display text-lg font-semibold text-rv-cyan">{tab.label}</span>
                <p className="font-body text-sm text-rv-text-dim">{tab.blurb}</p>
                <span className="mt-2 font-body text-xs text-rv-magenta">Log in to explore →</span>
              </Link>
            ))}
          </div>

          <p className="mt-8 font-body text-sm text-rv-text-dim">
            New here? <Link href="/signup" className="text-rv-cyan underline">Create an account</Link> to get
            started.
          </p>
        </main>
      )}
    </div>
  );
}
'@
$content = Apply-Edit $content $old3 $new3 "wrap end of tab section + add logged-out teaser"

if ($hadCrLf) { $content = $content.Replace("`n", "`r`n") }

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path $path).Path, $content, $utf8NoBom)
Write-Host ""
Write-Host "Done writing page.tsx. Check above for any FAILED lines." -ForegroundColor Cyan
