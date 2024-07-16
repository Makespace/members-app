import Handlebars from 'handlebars';

export const registerMemberInput = () => {
  Handlebars.registerPartial(
    'memberInput',
    `
      <fieldset>
        <legend>Select a member:</legend>
        {{#filterList this "Members"}}
          <div class="fieldset-item">
           <input type="radio" id="member-{{number}}" name="memberNumber" value="{{number}}"/>
           <label for="member-{{number}}">
           {{avatar_thumbnail this.emailAddress this.memberNumber}}
            <span>
              {{optional_detail name}}
              ({{optional_detail pronouns}})
              ({{email}})
            </span>
           </label>
         </div>
        {{/filterList}}
      </fieldset>
    `
  );
};
