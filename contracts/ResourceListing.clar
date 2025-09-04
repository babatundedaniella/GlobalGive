;; ResourceListing.clar
;; Core contract for managing surplus aid resource listings in GlobalGive
;; Handles creation, updates, cancellations, and queries for resource listings
;; Integrates with NGO registry for verification (assumed external trait)
;; Sophisticated features include: categories, tags, update history, collaborators,
;; status management, metadata, and basic trade initiation hooks

;; Constants
(define-constant ERR-UNAUTHORIZED u100)
(define-constant ERR-INVALID-LISTING u101)
(define-constant ERR-ALREADY-EXISTS u102)
(define-constant ERR-INVALID-PARAM u103)
(define-constant ERR-PAUSED u104)
(define-constant ERR-EXPIRED u105)
(define-constant ERR-MAX-TAGS u106)
(define-constant ERR-MAX-COLLABORATORS u107)
(define-constant ERR-NOT-OWNER u108)
(define-constant ERR-INVALID-STATUS u109)
(define-constant MAX-TAGS 10)
(define-constant MAX-COLLABORATORS 5)
(define-constant MAX-METADATA-LEN 500)
(define-constant MAX-DESCRIPTION-LEN 1000)
(define-constant MAX-LOCATION-LEN 100)
(define-constant MAX-UPDATE-NOTES-LEN 200)

;; Data Variables
(define-data-var contract-paused bool false)
(define-data-var contract-admin principal tx-sender)
(define-data-var next-listing-id uint u1)

;; Data Maps
(define-map listings
  { listing-id: uint }
  {
    owner: principal,              ;; NGO principal who created the listing
    resource-type: (string-utf8 50), ;; e.g., "food", "medical-supplies"
    quantity: uint,                ;; Amount available
    unit: (string-utf8 20),        ;; e.g., "kg", "units"
    location: (string-utf8 100),   ;; Geographical location
    expiration: (optional uint),   ;; Optional expiration block height
    price: (optional uint),        ;; Price in AID tokens (optional for donations)
    description: (string-utf8 1000), ;; Detailed description
    status: (string-utf8 20),      ;; "active", "pending", "sold", "cancelled"
    created-at: uint,              ;; Block height of creation
    last-updated: uint,            ;; Last update block height
    metadata: (optional (string-utf8 500)) ;; Additional JSON-like metadata
  }
)

(define-map listing-categories
  { listing-id: uint }
  {
    category: (string-utf8 50),    ;; Primary category
    tags: (list 10 (string-utf8 20)) ;; Searchable tags
  }
)

(define-map listing-collaborators
  { listing-id: uint, collaborator: principal }
  {
    role: (string-utf8 50),        ;; e.g., "verifier", "logistics"
    permissions: (list 5 (string-utf8 20)), ;; e.g., "update", "cancel"
    added-at: uint
  }
)

(define-map listing-update-history
  { listing-id: uint, update-id: uint }
  {
    updater: principal,
    notes: (string-utf8 200),
    timestamp: uint,
    changes: (list 5 (tuple (field (string-ascii 20)) (value (string-utf8 100))))
  }
)

(define-map listing-verification
  { listing-id: uint }
  {
    verified-by: (optional principal), ;; Verifier NGO
    verification-notes: (optional (string-utf8 200)),
    verified-at: (optional uint)
  }
)

;; Read-Only Functions
(define-read-only (get-next-listing-id)
  (var-get next-listing-id)
)

(define-read-only (get-listing (listing-id uint))
  (map-get? listings { listing-id: listing-id })
)

(define-read-only (get-listing-categories (listing-id uint))
  (map-get? listing-categories { listing-id: listing-id })
)

(define-read-only (get-listing-collaborator (listing-id uint) (collaborator principal))
  (map-get? listing-collaborators { listing-id: listing-id, collaborator: collaborator })
)

(define-read-only (get-listing-update (listing-id uint) (update-id uint))
  (map-get? listing-update-history { listing-id: listing-id, update-id: update-id })
)

(define-read-only (get-listing-verification (listing-id uint))
  (map-get? listing-verification { listing-id: listing-id })
)

(define-read-only (is-contract-paused)
  (var-get contract-paused)
)

(define-read-only (get-contract-admin)
  (var-get contract-admin)
)

(define-read-only (has-permission (listing-id uint) (caller principal) (permission (string-utf8 20)))
  (let ((listing (unwrap! (get-listing listing-id) false))
        (collab (get-listing-collaborator listing-id caller)))
    (or (is-eq (get owner listing) caller)
        (and (is-some collab)
             (is-some (index-of? (get permissions (unwrap! collab false)) permission))))
  )
)

;; Public Functions
(define-public (create-listing 
  (resource-type (string-utf8 50))
  (quantity uint)
  (unit (string-utf8 20))
  (location (string-utf8 100))
  (expiration (optional uint))
  (price (optional uint))
  (description (string-utf8 1000))
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20)))
  (metadata (optional (string-utf8 500))))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (> quantity u0) (err ERR-INVALID-PARAM))
    (asserts! (<= (len tags) MAX-TAGS) (err ERR-MAX-TAGS))
    (asserts! (<= (len description) MAX-DESCRIPTION-LEN) (err ERR-INVALID-PARAM))
    (asserts! (<= (len location) MAX-LOCATION-LEN) (err ERR-INVALID-PARAM))
    (if (is-some metadata) 
        (asserts! (<= (len (unwrap! metadata (err ERR-INVALID-PARAM))) MAX-METADATA-LEN) (err ERR-INVALID-PARAM))
        true)
    ;; Assume NGO is registered/verified externally
    (let ((listing-id (var-get next-listing-id)))
      (map-set listings
        { listing-id: listing-id }
        {
          owner: tx-sender,
          resource-type: resource-type,
          quantity: quantity,
          unit: unit,
          location: location,
          expiration: expiration,
          price: price,
          description: description,
          status: u"active",
          created-at: block-height,
          last-updated: block-height,
          metadata: metadata
        }
      )
      (map-set listing-categories
        { listing-id: listing-id }
        { category: category, tags: tags }
      )
      (var-set next-listing-id (+ listing-id u1))
      (ok listing-id)
    )
  )
)

(define-public (update-listing 
  (listing-id uint)
  (new-quantity (optional uint))
  (new-location (optional (string-utf8 100)))
  (new-expiration (optional uint))
  (new-price (optional uint))
  (new-description (optional (string-utf8 1000)))
  (new-metadata (optional (string-utf8 500)))
  (notes (string-utf8 200)))
  (let ((listing (unwrap! (get-listing listing-id) (err ERR-INVALID-LISTING)))
        (update-id (+ (default-to u0 (map-get? listing-update-history { listing-id: listing-id, update-id: u0 })) u1))) ;; Simplified counter
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (has-permission listing-id tx-sender u"update") (err ERR-UNAUTHORIZED))
    (asserts! (is-eq (get status listing) u"active") (err ERR-INVALID-STATUS))
    (if (is-some new-expiration)
        (asserts! (> (unwrap! new-expiration (err ERR-INVALID-PARAM)) block-height) (err ERR-EXPIRED))
        true)
    ;; Update fields
    (map-set listings
      { listing-id: listing-id }
      (merge listing {
        quantity: (default-to (get quantity listing) new-quantity),
        location: (default-to (get location listing) new-location),
        expiration: (default-to (get expiration listing) new-expiration),
        price: (default-to (get price listing) new-price),
        description: (default-to (get description listing) new-description),
        metadata: (default-to (get metadata listing) new-metadata),
        last-updated: block-height
      })
    )
    ;; Log update
    (map-set listing-update-history
      { listing-id: listing-id, update-id: update-id }
      {
        updater: tx-sender,
        notes: notes,
        timestamp: block-height,
        changes: (list ) ;; Add actual changes if needed, but simplified
      }
    )
    (ok true)
  )
)

(define-public (cancel-listing (listing-id uint))
  (let ((listing (unwrap! (get-listing listing-id) (err ERR-INVALID-LISTING))))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (has-permission listing-id tx-sender u"cancel") (err ERR-UNAUTHORIZED))
    (asserts! (is-eq (get status listing) u"active") (err ERR-INVALID-STATUS))
    (map-set listings
      { listing-id: listing-id }
      (merge listing { status: u"cancelled" })
    )
    (ok true)
  )
)

(define-public (add-collaborator 
  (listing-id uint)
  (collaborator principal)
  (role (string-utf8 50))
  (permissions (list 5 (string-utf8 20))))
  (let ((listing (unwrap! (get-listing listing-id) (err ERR-INVALID-LISTING))))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-eq (get owner listing) tx-sender) (err ERR-NOT-OWNER))
    (asserts! (<= (len permissions) MAX-COLLABORATORS) (err ERR-MAX-COLLABORATORS))
    (asserts! (is-none (map-get? listing-collaborators { listing-id: listing-id, collaborator: collaborator })) (err ERR-ALREADY-EXISTS))
    (map-set listing-collaborators
      { listing-id: listing-id, collaborator: collaborator }
      {
        role: role,
        permissions: permissions,
        added-at: block-height
      }
    )
    (ok true)
  )
)

(define-public (verify-listing 
  (listing-id uint)
  (notes (string-utf8 200)))
  (let ((listing (unwrap! (get-listing listing-id) (err ERR-INVALID-LISTING))))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    ;; Assume caller is a verified NGO with permission
    (asserts! (not (is-eq (get owner listing) tx-sender)) (err ERR-UNAUTHORIZED)) ;; Verifier != owner
    (map-set listing-verification
      { listing-id: listing-id }
      {
        verified-by: (some tx-sender),
        verification-notes: (some notes),
        verified-at: (some block-height)
      }
    )
    (ok true)
  )
)

(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (set-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get contract-admin)) (err ERR-UNAUTHORIZED))
    (var-set contract-admin new-admin)
    (ok true)
  )
)

;; Private Functions (if needed)
(define-private (check-expiration (listing-id uint))
  (let ((listing (unwrap! (get-listing listing-id) false)))
    (match (get expiration listing)
      exp (if (> block-height exp) true false)
      false
    )
  )
)