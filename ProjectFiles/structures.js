'use strict';
// PULSE: an educational emergency patient management system.
// The arrays used for rendering / JSON are snapshots, not the live queue or history.
// Live storage: heap of active levels + linked FIFO queues + BST + history list.

// A FIFO node owns one patient and a reference to the next node, not its index.
class QueueNode {
  constructor(patient) { this.patient = patient; this.next = null; }
}
class PatientQueue {
  constructor() { this.head = null; this.tail = null; this.size = 0; }
  enqueue(patient) {
    const node = new QueueNode(patient);
    // An empty queue has no tail. Otherwise link the existing tail to the new node.
    if (this.tail) this.tail.next = node; else this.head = node;
    this.tail = node;
    this.size++;
  }
  dequeue() {
    if (!this.head) return null;
    const patient = this.head.patient;
    // Moving head drops the old node from the list; GC can reclaim it.
    this.head = this.head.next;
    if (!this.head) this.tail = null; // Last removal must clear BOTH pointers.
    this.size--;
    return patient;
  }
  remove(id) {
    let previous = null, current = this.head;
    while (current) {
      if (current.patient.id === id) {
        // Bypass current: predecessor -> successor. Head is a special case.
        if (previous) previous.next = current.next; else this.head = current.next;
        if (current === this.tail) this.tail = previous;
        this.size--;
        return current.patient;
      }
      previous = current;
      current = current.next;
    }
    return null;
  }
  toArray() {
    const result = [];
    for (let n = this.head; n; n = n.next) result.push(n.patient);
    return result;
  }
}

// Array-backed binary max heap, storing each active emergency level exactly once.
// For position i: parent = floor((i-1)/2), left = 2i+1, right = 2i+2.
class MaxHeap {
  constructor() { this.items = []; }
  peek() { return this.items[0] ?? null; }
  insert(level) {
    this.items.push(level);
    let i = this.items.length - 1;
    // Bubble the newly inserted value upward until the max-heap rule is restored.
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.items[parent] >= this.items[i]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }
  remove(level) {
    // There are at most 5 levels; finding an arbitrary level takes O(k).
    // Root removal (used for treatment) is found at index zero.
    let i = this.items.indexOf(level);
    if (i < 0) return;
    const last = this.items.pop();
    if (i === this.items.length) return;
    this.items[i] = last;
    // Replacement might need to move up OR down, especially after cancellation.
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.items[parent] >= this.items[i]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
    while (true) {
      let largest = i;
      const left = i * 2 + 1, right = left + 1;
      if (left < this.items.length && this.items[left] > this.items[largest]) largest = left;
      if (right < this.items.length && this.items[right] > this.items[largest]) largest = right;
      if (largest === i) break;
      [this.items[i], this.items[largest]] = [this.items[largest], this.items[i]];
      i = largest;
    }
  }
}

class TreeNode {
  constructor(patient) { this.patient = patient; this.left = null; this.right = null; }
}
class PatientBST {
  constructor() { this.root = null; }
  insert(patient) {
    const node = new TreeNode(patient);
    if (!this.root) { this.root = node; return; }
    let current = this.root;
    while (true) {
      if (patient.id === current.patient.id) throw new Error('Duplicate patient ID');
      // IDs are normalized uppercase strings: comparison is lexicographic, not numeric.
      const side = patient.id < current.patient.id ? 'left' : 'right';
      if (!current[side]) { current[side] = node; return; }
      current = current[side];
    }
  }
  search(id) {
    let current = this.root;
    while (current) {
      if (id === current.patient.id) return current.patient;
      current = id < current.patient.id ? current.left : current.right;
    }
    return null;
  }
  remove(id) {
    // Iterative deletion avoids recursion limits on a highly unbalanced tree.
    let parent = null, node = this.root;
    while (node && node.patient.id !== id) {
      parent = node;
      node = id < node.patient.id ? node.left : node.right;
    }
    if (!node) return;
    if (node.left && node.right) {
      // Two children: find the smallest node of the right subtree (successor).
      let successorParent = node, successor = node.right;
      while (successor.left) { successorParent = successor; successor = successor.left; }
      node.patient = successor.patient;
      // Delete the successor instead; it has at most one child.
      parent = successorParent; node = successor;
    }
    const child = node.left || node.right;
    if (!parent) this.root = child;
    else if (parent.left === node) parent.left = child;
    else parent.right = child;
  }
}

class HistoryNode {
  constructor(patient, treatedAt) {
    this.patient = patient;
    this.treatedAt = treatedAt;
    this.next = null;
  }
}
class TreatmentHistory {
  constructor() { this.head = null; this.size = 0; }
  prepend(patient, treatedAt = new Date().toISOString()) {
    const node = new HistoryNode(patient, treatedAt);
    // The new record points to the ENTIRE old list via its previous head.
    // Then head changes to the new node. No traversal or array shifting required.
    node.next = this.head;
    this.head = node;
    this.size++;
  }
  toArray() {
    const records = [];
    // Follow next references until null; the newest treatment appears first.
    for (let current = this.head; current; current = current.next) {
      records.push({ patient: current.patient, treatedAt: current.treatedAt });
    }
    return records;
  }
}

export class EmergencySystem {
  constructor() {
    this.heap = new MaxHeap();
    this.queues = new Map();
    this.index = new PatientBST();
    this.history = new TreatmentHistory();
    this.arrival = 0;
    // This set enforces lifetime ID uniqueness, including cancelled / treated IDs.
    this.usedIds = new Set();
  }
  addToStructures(patient) {
    this.index.insert(patient);
    if (!this.queues.has(patient.level)) {
      this.queues.set(patient.level, new PatientQueue());
      this.heap.insert(patient.level);
    }
    this.queues.get(patient.level).enqueue(patient);
  }
  register(id, name, level) {
    id = id.trim().toUpperCase(); name = name.trim(); level = Number(level);
    if (!/^[A-Z0-9-]{1,24}$/.test(id)) throw new Error('Use an ID with letters, numbers, or hyphens (max 24).');
    if (!name || name.length > 70) throw new Error('Enter a name between 1 and 70 characters.');
    if (!Number.isInteger(level) || level < 1 || level > 5) throw new Error('Select a valid emergency level.');
    if (this.usedIds.has(id)) throw new Error('This patient ID has already been used. Please choose a unique ID.');
    const patient = { id, name, level, arrival: ++this.arrival, registeredAt: new Date().toISOString() };
    this.addToStructures(patient);
    this.usedIds.add(id);
    return patient;
  }
  next() {
    const level = this.heap.peek();
    return level === null ? null : this.queues.get(level).head.patient;
  }
  cleanLevel(level) {
    if (this.queues.get(level).size === 0) {
      this.queues.delete(level);
      this.heap.remove(level);
    }
  }
  treat() {
    const level = this.heap.peek();
    if (level === null) return null;
    // The heap chooses emergency level; FIFO chooses the earliest arrival in it.
    const patient = this.queues.get(level).dequeue();
    this.cleanLevel(level);
    this.index.remove(patient.id);
    this.history.prepend(patient);
    return patient;
  }
  cancel(id) {
    const patient = this.index.search(id);
    if (!patient) return null;
    this.queues.get(patient.level).remove(id);
    this.cleanLevel(patient.level);
    this.index.remove(id);
    return patient;
  }
  waiting() {
    // Sorting a COPY of the 5 heap levels is just for display, never for scheduling.
    return [...this.heap.items].sort((a, b) => b - a).flatMap(level => this.queues.get(level).toArray());
  }
  save() {
    // JSON cannot retain node references/classes. Save plain snapshots instead.
    try {
      localStorage.setItem('pulse-emergency-v1', JSON.stringify({
        waiting: this.waiting(), history: this.history.toArray(),
        arrival: this.arrival, usedIds: [...this.usedIds]
      }));
    } catch (_) { throw new Error('Browser storage is unavailable; changes are kept for this session only.'); }
  }
}

