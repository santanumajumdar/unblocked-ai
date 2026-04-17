/**
 * voice.js — J.A.R.V.I.S. Voice Protocol System
 * Handles Speech Recognition (Listen) and Speech Synthesis (Speak).
 */

class JarvisVoiceEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.recognition = null;
    this.isListening = false;
    this.voiceMode = false;
    this.selectedVoice = null;
    
    this.initRecognition();
    this.initVoices();
  }

  initVoices() {
    const setVoice = () => {
      const voices = this.synth.getVoices();
      // Prioritize high-quality British male voices (Jarvis-like)
      this.selectedVoice = voices.find(v => 
        (v.name.includes('Daniel') || v.name.includes('British') || v.name.includes('UK')) && 
        v.name.includes('Male')
      ) || voices.find(v => v.lang.startsWith('en-GB')) || voices[0];
    };
    
    setVoice();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = setVoice;
    }
  }

  initRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition not supported in this browser.');
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true; // Enabled for real-time feedback
    this.recognition.lang = 'en-US';
  }

  speak(text) {
    if (!this.voiceMode || !this.synth) return;
    
    // Stop any current speech
    this.synth.cancel();

    // Clean text (remove JSON segments)
    const cleanText = text.replace(/\{[\s\S]*?\}/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.voice = this.selectedVoice;
    utterance.pitch = 0.9; // Slightly deeper
    utterance.rate = 1.0;  // Measured pace
    utterance.volume = 1.0;

    this.synth.speak(utterance);
  }

  listen(onResult, onError, onInterim) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      if (onError) onError('Speech Recognition not supported.');
      return;
    }

    if (this.isListening) return;

    // Create a fresh instance for every session to avoid "zombie" states
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      this.isListening = true;
      document.body.classList.add('jarvis-listening');
      console.log('J.A.R.V.I.S. Audio Stream: Connected');
    };

    rec.onsoundstart = () => console.log('J.A.R.V.I.S. Audio Stream: Capturing signals...');

    rec.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript && onResult) {
        onResult(finalTranscript);
      } else if (interimTranscript && onInterim) {
        onInterim(interimTranscript);
      }
    };

    rec.onerror = (event) => {
      console.error('J.A.R.V.I.S. Recognition error:', event.error);
      if (onError) onError(event.error);
    };

    rec.onend = () => {
      this.isListening = false;
      document.body.classList.remove('jarvis-listening');
      console.log('J.A.R.V.I.S. Audio Stream: Disconnected');
    };

    try {
      rec.start();
    } catch (e) {
      console.error('Failed to start recognition directive:', e);
      if (onError) onError(e.message);
    }
  }

  setVoiceMode(active) {
    this.voiceMode = active;
    if (!active) this.synth.cancel();
  }
}

export const jarvisVoice = new JarvisVoiceEngine();
