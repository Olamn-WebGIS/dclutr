param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

$lines = @(
  @{ File = "voice-1.wav"; Rate = 1; Text = "Got things you no longer use? Turn them into cash." },
  @{ File = "voice-2.wav"; Rate = 1; Text = "Phone stands, fridges, fans, sneakers. Find them nearby." },
  @{ File = "voice-3.wav"; Rate = 1; Text = "List on D clutr in minutes. Find deals nearby." },
  @{ File = "voice-4.wav"; Rate = 1; Text = "D clutr. Buy and sell at the Federal University of Technology, Akure." }
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
