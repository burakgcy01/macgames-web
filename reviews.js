import {
  auth,
  db,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from './firebase.js';

const summaries = new Map();
const panels = [];
let currentUser = null;

function setReviewsUnavailable(gameId, message = 'Ratings unavailable') {
  const state = summaries.get(gameId);
  if (state) {
    state.unavailable = true;
    state.reviews = [];
  }

  document.querySelectorAll(`[data-rating-summary="${gameId}"]`).forEach(el => {
    el.textContent = message;
  });

  document.querySelectorAll(`[data-rating-stars="${gameId}"]`).forEach(el => {
    el.textContent = '☆☆☆☆☆';
  });

  panels.filter(panel => panel.gameId === gameId).forEach(panel => {
    panel.summary.textContent = message;
    panel.summaryStars.textContent = '☆☆☆☆☆';
    panel.form.hidden = true;
    panel.signIn.hidden = true;
    panel.signOut.hidden = true;
    panel.authText.textContent = 'Reviews are not enabled yet.';
    renderReviewList(panel);
  });
}

function reviewCollection(gameId) {
  return collection(db, 'games', gameId, 'reviews');
}

function reviewDoc(gameId, uid) {
  return doc(db, 'games', gameId, 'reviews', uid);
}

function starsText(value) {
  const full = Math.round(Number(value) || 0);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

function formatAverage(avg, count) {
  if (!count) return 'No ratings yet';
  return `${avg.toFixed(1)} ★ · ${count} review${count === 1 ? '' : 's'}`;
}

function summarizeSnapshot(snapshot) {
  let total = 0;
  let count = 0;
  const reviews = [];

  snapshot.forEach(item => {
    const data = item.data();
    const rating = Number(data.rating) || 0;
    if (rating > 0) {
      total += rating;
      count += 1;
    }
    reviews.push({ id: item.id, ...data, rating });
  });

  return {
    avg: count ? total / count : 0,
    count,
    reviews
  };
}

function subscribeGame(gameId) {
  if (summaries.has(gameId)) return;

  const state = { avg: 0, count: 0, reviews: [] };
  summaries.set(gameId, state);

  const q = query(reviewCollection(gameId), orderBy('updatedAt', 'desc'));
  state.unsubscribe = onSnapshot(q, snapshot => {
    state.unavailable = false;
    Object.assign(state, summarizeSnapshot(snapshot));
    renderSummary(gameId);
    panels.filter(panel => panel.gameId === gameId).forEach(renderPanel);
  }, error => {
    console.warn('Review feed failed:', error);
    setReviewsUnavailable(gameId);
  });
}

function renderSummary(gameId) {
  const state = summaries.get(gameId);
  if (!state) return;

  document.querySelectorAll(`[data-rating-summary="${gameId}"]`).forEach(el => {
    el.textContent = formatAverage(state.avg, state.count);
  });

  document.querySelectorAll(`[data-rating-stars="${gameId}"]`).forEach(el => {
    el.textContent = state.count ? starsText(state.avg) : '☆☆☆☆☆';
  });
}

function createStarPicker(panel) {
  panel.starPicker.innerHTML = '';
  for (let i = 1; i <= 5; i += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'review-star';
    button.textContent = '★';
    button.setAttribute('aria-label', `${i} star`);
    button.addEventListener('click', () => {
      panel.rating = i;
      updateStarPicker(panel);
    });
    panel.starPicker.appendChild(button);
  }
  updateStarPicker(panel);
}

function updateStarPicker(panel) {
  [...panel.starPicker.children].forEach((button, index) => {
    button.classList.toggle('active', index < panel.rating);
  });
}

function renderReviewList(panel) {
  const state = summaries.get(panel.gameId);
  panel.list.innerHTML = '';

  if (state && state.unavailable) {
    const empty = document.createElement('p');
    empty.className = 'reviews-empty';
    empty.textContent = 'Reviews will appear here after Firebase permissions are enabled.';
    panel.list.appendChild(empty);
    return;
  }

  if (!state || state.reviews.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'reviews-empty';
    empty.textContent = 'No reviews yet. Be the first to rate this game.';
    panel.list.appendChild(empty);
    return;
  }

  state.reviews.slice(0, 20).forEach(review => {
    const card = document.createElement('article');
    card.className = 'review-card';

    const top = document.createElement('div');
    top.className = 'review-card-top';

    const author = document.createElement('strong');
    author.textContent = review.displayName || 'Player';

    const rating = document.createElement('span');
    rating.className = 'review-card-stars';
    rating.textContent = starsText(review.rating);

    top.append(author, rating);

    const message = document.createElement('p');
    message.textContent = review.message || '';

    card.append(top, message);
    panel.list.appendChild(card);
  });
}

async function loadOwnReview(panel) {
  if (!currentUser) return;

  let own;
  try {
    own = await getDoc(reviewDoc(panel.gameId, currentUser.uid));
  } catch (error) {
    console.warn('Own review load failed:', error);
    setReviewsUnavailable(panel.gameId);
    return;
  }

  if (!own.exists()) return;

  const data = own.data();
  panel.rating = Number(data.rating) || 0;
  panel.message.value = data.message || '';
  updateStarPicker(panel);
  panel.submit.textContent = 'Update review';
}

function renderPanel(panel) {
  const state = summaries.get(panel.gameId);
  if (state && state.unavailable) {
    panel.summary.textContent = 'Ratings unavailable';
    panel.summaryStars.textContent = '☆☆☆☆☆';
    panel.authText.textContent = 'Reviews are not enabled yet.';
    panel.signIn.hidden = true;
    panel.signOut.hidden = true;
    panel.form.hidden = true;
    renderReviewList(panel);
    return;
  }

  panel.summary.textContent = state ? formatAverage(state.avg, state.count) : 'Loading ratings...';
  panel.summaryStars.textContent = state && state.count ? starsText(state.avg) : '☆☆☆☆☆';

  if (currentUser) {
    panel.authText.textContent = currentUser.displayName || currentUser.email || 'Signed in';
    panel.signIn.hidden = true;
    panel.signOut.hidden = false;
    panel.form.hidden = false;
  } else {
    panel.authText.textContent = 'Sign in with Google to leave one editable review per game.';
    panel.signIn.hidden = false;
    panel.signOut.hidden = true;
    panel.form.hidden = true;
  }

  renderReviewList(panel);
}

async function submitReview(panel) {
  if (!currentUser) {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.warn('Sign in failed:', error);
      panel.status.textContent = 'Sign in failed.';
    }
    return;
  }

  const message = panel.message.value.trim();
  if (panel.rating < 1 || panel.rating > 5) {
    panel.status.textContent = 'Choose a rating first.';
    return;
  }
  if (message.length < 2) {
    panel.status.textContent = 'Write a short message too.';
    return;
  }

  panel.submit.disabled = true;
  panel.status.textContent = 'Saving...';

  try {
    await setDoc(reviewDoc(panel.gameId, currentUser.uid), {
      uid: currentUser.uid,
      displayName: currentUser.displayName || currentUser.email || 'Player',
      photoURL: currentUser.photoURL || '',
      rating: panel.rating,
      message: message.slice(0, 700),
      updatedAt: serverTimestamp()
    }, { merge: true });

    panel.submit.textContent = 'Update review';
    panel.status.textContent = 'Saved.';
    setTimeout(() => { panel.status.textContent = ''; }, 2500);
  } catch (error) {
    console.warn('Review save failed:', error);
    panel.status.textContent = 'Reviews are not enabled yet.';
  } finally {
    panel.submit.disabled = false;
  }
}

function initPanel(root) {
  const panel = {
    root,
    gameId: root.dataset.reviewPanel,
    rating: 0,
    summary: root.querySelector('[data-review-summary]'),
    summaryStars: root.querySelector('[data-review-summary-stars]'),
    authText: root.querySelector('[data-review-auth-text]'),
    signIn: root.querySelector('[data-review-sign-in]'),
    signOut: root.querySelector('[data-review-sign-out]'),
    form: root.querySelector('[data-review-form]'),
    starPicker: root.querySelector('[data-review-stars-input]'),
    message: root.querySelector('[data-review-message]'),
    submit: root.querySelector('[data-review-submit]'),
    status: root.querySelector('[data-review-status]'),
    list: root.querySelector('[data-review-list]')
  };

  createStarPicker(panel);
  panel.signIn.addEventListener('click', () => {
    signInWithPopup(auth, googleProvider).catch(error => {
      console.warn('Sign in failed:', error);
      panel.authText.textContent = 'Sign in failed.';
    });
  });
  panel.signOut.addEventListener('click', () => {
    signOut(auth).catch(error => console.warn('Sign out failed:', error));
  });
  panel.submit.addEventListener('click', () => submitReview(panel));
  panels.push(panel);
  subscribeGame(panel.gameId);
  renderPanel(panel);
}

document.querySelectorAll('[data-rating-summary]').forEach(el => {
  subscribeGame(el.dataset.ratingSummary);
});

document.querySelectorAll('[data-review-panel]').forEach(initPanel);

onAuthStateChanged(auth, user => {
  currentUser = user;
  panels.forEach(panel => {
    panel.rating = 0;
    panel.message.value = '';
    panel.submit.textContent = 'Post review';
    updateStarPicker(panel);
    renderPanel(panel);
  });

  if (currentUser) {
    Promise.all(panels.map(loadOwnReview))
      .then(() => panels.forEach(renderPanel))
      .catch(error => console.warn('Review auth refresh failed:', error));
  }
});
