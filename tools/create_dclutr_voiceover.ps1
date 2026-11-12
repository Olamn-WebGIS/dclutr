param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

$lines = @(
  @{ File = "voice-1.wav"; Rate = 2; Text = "Got unused stuff? Sell it." },
  @{ File = "voice-2.wav"; Rate = 2; Text = "Books, mattresses, and fridges. Someone on campus needs them." },
  @{ File = "voice-3.wav"; Rate = 2; Text = "List on D clutr in minutes. Shop affordable finds near you." },
  @{ File = "voice-4.wav"; Rate = 4; Text = "D clutr. Buy or sell at FUTA." }
)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $synth.SelectVoice("Microsoft Zira Desktop")
  $synth.Volume = 100

  foreach ($line in $lines) {
    $synth.Rate = $line.Rate
    $synth.SetOutputToWaveFile((Join-Path $OutputDirectory $line.File))
    $synth.Speak($line.Text)
    $synth.SetOutputToNull()
  }
}
finally {
  $synth.Dispose()
}
