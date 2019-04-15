// define data variables here
const initial_data = {
  question: null,
  name_submission: false,
  already_answered: false,
  selected: null,
  show_stats: false,
  responses: null,
  ans_responses: null,
  disp_responses: null,
  prevIndTableDisabled: true,
  nextIndTableDisabled: false,
  indTableCursor: 0,
  user: null,
  maxIndPageSize: 5,
  colors: ["red", "green", "blue", "yellow"],
  authenticated: false,
  new_user_form: false,
  login_error: false,
  login_error_message: "wtg"
};
const app = new Vue({
  el: "#app-container",
  // turns out that vue modifies the original object, so send in a copy instead
  data: { ...initial_data },
  created: function() {
    /**
     * query firebase to get a random question
     * save the random question into the data object
     */
    this.setQuestion();
  },
  methods: {
    logIn: function(e) {
      e.preventDefault();
      const email = document.getElementById("email-input");
      const password = document.getElementById("password-input");
      const c_pw = document.getElementById("confirm-password-input");
      const context = this;
      if (this.new_user_form) {
        if (password.value !== c_pw.value) return this.passwordMismatch();
        firebase
          .auth()
          .createUserWithEmailAndPassword(email.value, password.value)
          .then(res => {
            context.loginSuccessful(res.user);
          })
          .catch(function(error) {
            // Handle Errors here.
            const errorMessage = error.message;
            // ...
            context.login_error = true;
            context.login_error_message = errorMessage;
          });
      } else {
        firebase
          .auth()
          .signInWithEmailAndPassword(email.value, password.value)
          .then(res => {
            context.loginSuccessful(res.user);
          })
          .catch(function(error) {
            // Handle Errors here.
            const errorMessage = error.message;
            // ...
            context.login_error = true;
            context.login_error_message = errorMessage;
          });
      }
    },
    loginSuccessful: function(user) {
      this.authenticated = true;
      this.new_user_form = false;
      this.login_error = false;
      this.login_error_message = null;
      this.user = user.email;
    },
    logoutSuccessful: function() {
      this.resetState(true);
    },
    logOut: function(e) {
      e.preventDefault();
      const context = this;
      firebase
        .auth()
        .signOut()
        .then(function() {
          // Sign-out successful.
          context.logoutSuccessful();
        })
        .catch(function(error) {
          // An error happened.
          context.handleError(error);
        });
    },
    passwordMismatch: function() {
      this.login_error = true;
      this.login_error_message = "Passwords do not match.";
    },
    showNewUserForm: function() {
      this.new_user_form = true;
    },
    hideNewUserForm: function() {
      this.new_user_form = false;
    },
    resetState: function(reset_user = false) {
      Object.keys(initial_data).forEach(k => {
        if (!reset_user && (k === "user" || k === "authenticated")) return;
        this[k] = initial_data[k];
      });
    },
    submit: function() {
      /**
       * validate that this user has not submitted a response for this question
       * if validated, then save response into firebase
       * if not validated, then hide input to get username and show message that says "you've already answered this question"
       */

      this.getResponses(this.question.id)
        .then(responses => {
          responses = responses.filter(r => r.user_id === this.user);
          if (responses.length) {
            this.selected = responses[0].option_idx;
            // this person has already answered this question, don't save to db
            this.already_answered = true;
          } else {
            // save response to db
            const db = firebase.firestore();
            db.collection("responses")
              .add({
                question_id: this.question.id,
                user_id: this.user,
                option_idx: this.selected
              })
              .then(() => {
                this.displayQuestionStats();
                document
                  .getElementById("question-container")
                  .classList.remove("faded");
              })
              .catch(this.handleError);
          }
        })
        .catch(this.handleError);
    },
    cancel: function() {
      /**
       * hide input to get user name
       */
      this.name_submission = false;
      document.getElementById("question-container").classList.remove("faded");
    },
    close: function() {
      /**
       * close "you've already answered" message
       */
      this.already_answered = false;
      document.getElementById("question-container").classList.remove("faded");
      this.displayQuestionStats();
    },
    next: function() {
      this.setQuestion();
    },
    setRadioOption: function(event) {
      this.selected = event.target.value;
    },
    setQuestion: function() {
      this.resetState();

      const db = firebase.firestore();
      const questions = db.collection("questions");
      questions
        .get()
        .then(sc => {
          const qs = [];
          sc.forEach(q =>
            qs.push({
              id: q.id,
              ...q.data()
            })
          );
          let idx = Math.floor(Math.random() * qs.length);
          // don't display the same question again
          while (this.question && qs[idx].id === this.question.id)
            idx = Math.floor(Math.random() * qs.length);
          this.question = qs[idx];
        })
        .catch(this.handleError);
    },
    displayNameRequired: function() {
      document.getElementById("name-input").classList.add("error");
    },
    displayQuestionStats: function() {
      this.getResponses(this.question.id)
        .then(responses => {
          this.displayQuestionStatsHelper(responses);
        })
        .catch(this.handleError);
    },
    displayQuestionStatsHelper: function(responses) {
      this.responses = responses;
      this.show_stats = true;
      // handle disabling of next/prev buttons
      if (this.responses.length <= this.maxIndPageSize)
        this.nextIndTableDisabled = true;
      else this.nextIndTableDisabled = false;
      // get display slice
      this.disp_responses = this.responses.slice(0, this.maxIndPageSize);
      // init response array for second stats table
      this.ans_responses = [
        { count: 0, percentage: 0 },
        { count: 0, percentage: 0 },
        { count: 0, percentage: 0 },
        { count: 0, percentage: 0 }
      ];
      // generate second stats table array
      this.responses.forEach(r => {
        this.ans_responses[r.option_idx] = this.ans_responses[r.option_idx] || {
          count: 0
        };
        this.ans_responses[r.option_idx].count++;
        this.ans_responses[r.option_idx].percentage =
          (this.ans_responses[r.option_idx].count / this.responses.length) *
          100;
      });
      // these colors are used for styling purposes
      this.ans_responses.forEach((obj, i) => {
        obj.color = this.colors[i];
      });
    },
    hideQuestionStats: function() {
      this.show_stats = false;
    },
    prevIndTable: function() {
      this.nextIndTableDisabled = false;
      this.disp_responses = this.responses.slice(
        this.indTableCursor - this.maxIndPageSize,
        this.indTableCursor
      );
      this.indTableCursor -= this.maxIndPageSize;
      if (
        this.responses[this.indTableCursor - this.maxIndPageSize] === undefined
      )
        this.prevIndTableDisabled = true;
    },
    nextIndTable: function() {
      this.prevIndTableDisabled = false;
      this.disp_responses = this.responses.slice(
        this.indTableCursor + this.maxIndPageSize,
        this.indTableCursor + this.maxIndPageSize * 2
      );
      this.indTableCursor += this.maxIndPageSize;
      if (
        this.responses[this.indTableCursor + this.maxIndPageSize] === undefined
      )
        this.nextIndTableDisabled = true;
    },
    getResponses: function(qID) {
      // gets responses to this question
      const db = firebase.firestore();
      return db
        .collection("responses")
        .where("question_id", "==", qID)
        .get()
        .then(sc => {
          let responses = [];
          sc.forEach(s => responses.push(s.data()));
          return responses;
        });
    },
    handleError: function(e) {
      window.alert(
        "Oops, something went wrong. If the page doesn't work, a quick refresh should get it back to working condition."
      );
    },
    changePageViewCount: function(e) {
      this.maxIndPageSize = +e.target.value;
      this.displayQuestionStatsHelper(this.responses);
    }
  }
});
